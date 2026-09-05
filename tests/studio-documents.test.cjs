const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const express = require('express')

const { createStudioRouter } = require('../lib/studio.cjs')

async function listen(app, t) {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  t.after(() => new Promise(resolve => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}/api/studio`
}

async function waitForJob(base, id, expectedStatus, timeoutMs = 2_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${base}/jobs/${id}`)
    assert.equal(response.status, 200)
    const { job } = await response.json()
    if (job.status === expectedStatus) return job
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.fail(`Задание ${id} не перешло в статус ${expectedStatus}`)
}

test('documents can be archived, restored and permanently deleted with confirmation', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-documents-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = 'a'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Archive test', filename: 'archive.pdf', pageCount: 2, objectCount: 4,
    createdAt: '2026-09-05T00:00:00.000Z', updatedAt: '2026-09-05T00:00:00.000Z', archivedAt: null,
  }))

  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({
    rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python',
    runProcess: async () => ({ code: 0, stdout: '', stderr: '' }),
  }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  let response = await fetch(`${base}/documents`)
  assert.deepEqual((await response.json()).documents.map(item => item.id), [id])

  const uploadBytes = Buffer.from('%PDF-1.7\nstreamed test document\n%%EOF')
  response = await fetch(`${base}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent('large.pdf') },
    body: uploadBytes,
  })
  assert.equal(response.status, 202)
  const uploadJob = (await response.json()).job
  assert.deepEqual(await fs.promises.readFile(path.join(dataDir, uploadJob.documentId, 'source.pdf')), uploadBytes)
  await waitForJob(base, uploadJob.id, 'failed')

  response = await fetch(`${base}/jobs/${uploadJob.id}/retry`, { method: 'POST' })
  assert.equal(response.status, 202)
  const retryJob = (await response.json()).job
  assert.notEqual(retryJob.id, uploadJob.id)
  assert.equal(retryJob.documentId, uploadJob.documentId)
  assert.equal(retryJob.title, uploadJob.title)
  response = await fetch(`${base}/jobs/${uploadJob.id}/retry`, { method: 'POST' })
  assert.equal(response.status, 409)

  response = await fetch(`${base}/documents/${id}/archive`, { method: 'POST' })
  assert.equal(response.status, 200)
  assert.ok((await response.json()).metadata.archivedAt)
  response = await fetch(`${base}/documents`)
  assert.equal((await response.json()).documents.length, 0)
  response = await fetch(`${base}/documents?scope=archived`)
  assert.deepEqual((await response.json()).documents.map(item => item.id), [id])

  response = await fetch(`${base}/documents/${id}/archive`, { method: 'DELETE' })
  assert.equal((await response.json()).metadata.archivedAt, null)

  response = await fetch(`${base}/documents/${id}`, { method: 'DELETE' })
  assert.equal(response.status, 400)
  assert.equal(fs.existsSync(directory), true)
  response = await fetch(`${base}/documents/${id}`, {
    method: 'DELETE', headers: { 'X-Confirm-Document-Id': id },
  })
  assert.equal(response.status, 204)
  assert.equal(fs.existsSync(directory), false)
})

test('provider key can be persisted server-side without exposing it through the API', async t => {
  const rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-provider-env-'))
  t.after(() => fs.promises.rm(rootDir, { recursive: true, force: true }))
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({
    rootDir, dataDir: path.join(rootDir, 'data'), pythonBin: 'python',
    runProcess: async () => ({ code: 1, stdout: '', stderr: 'not configured' }),
  }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)
  let response = await fetch(`${base}/provider`)
  const settings = await response.json()
  const secret = 'test-provider-key-without-real-access'
  const encryptedApiKey = crypto.publicEncrypt({
    key: settings.publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  }, Buffer.from(secret)).toString('base64')

  response = await fetch(`${base}/provider`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'aitunnel', model: 'vision-model', encryptedApiKey, persistKey: true }),
  })
  assert.equal(response.status, 200)
  const savedSettings = await response.json()
  assert.equal(savedSettings.keyConfigured, true)
  assert.equal(savedSettings.keyPersisted, true)
  assert.equal(savedSettings.secretPersistence, 'server-environment')
  assert.equal(JSON.stringify(savedSettings).includes(secret), false)
  const envPath = path.join(rootDir, '.env')
  const envContent = await fs.promises.readFile(envPath, 'utf8')
  assert.match(envContent, /TRANSLATION_API_KEY=/)
  assert.equal((await fs.promises.stat(envPath)).mode & 0o777, 0o600)

  response = await fetch(`${base}/provider/key`, { method: 'DELETE' })
  assert.equal(response.status, 200)
  const clearedSettings = await response.json()
  assert.equal(clearedSettings.keyConfigured, false)
  assert.equal(clearedSettings.keyPersisted, false)
  assert.doesNotMatch(await fs.promises.readFile(envPath, 'utf8'), /(?:TRANSLATION|AI)_API_KEY=/)
})

test('translation route proposes exact knowledge-base matches without silently applying them', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-translation-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = 'b'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Translation test', filename: 'translation.pdf', revision: 1, pageCount: 1, objectCount: 1,
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Translation test', sourceLanguage: 'en', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'object-1', pageIndex: 0, type: 'text', readingOrder: 1, sourceText: 'Power of attorney', translation: '', confidence: 1,
      x: 40, y: 40, width: 300, height: 40, style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      originalBounds: { x: 40, y: 40, width: 300, height: 40 },
    }],
  }))
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({
    rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python',
    runProcess: async () => ({ code: 1, stdout: '', stderr: 'not configured' }),
  }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  let response = await fetch(`${base}/knowledge-base/entries`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceText: 'Power of attorney', translation: 'Доверенность', sourceLanguage: 'en', targetLanguage: 'ru' }),
  })
  assert.equal(response.status, 201)
  response = await fetch(`${base}/documents/${id}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectIds: ['object-1'] }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.translated.length, 0)
  assert.equal(result.suggested.length, 1)
  assert.equal(result.scene.objects[0].translation, '')
  assert.equal(result.scene.objects[0].translationUnits[0].memorySuggestion.translation, 'Доверенность')
  assert.equal(result.scene.objects[0].translationUnits[0].status, 'memory-suggested')
})
