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
    id, title: 'Archive test', filename: 'archive.pdf', revision: 1, pageCount: 2, objectCount: 4,
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

  const scene = {
    documentId: id, title: 'Archive test', sourceLanguage: 'en', targetLanguage: 'ru',
    pages: [{
      index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123,
      contentBounds: { x: 40, y: 40, width: 704, height: 1034 },
      gridAvailableBounds: { width: 714, height: 1043 },
    }],
    objects: [
      { id: 'lower', pageIndex: 0, type: 'text', readingOrder: 1, sourceText: 'Lower', x: 40, y: 200, width: 200, height: 40, style: {} },
      { id: 'upper-right', pageIndex: 0, type: 'text', readingOrder: 2, sourceText: 'Upper right', x: 300, y: 40, width: 200, height: 40, style: {} },
      { id: 'upper-left', pageIndex: 0, type: 'text', readingOrder: 3, sourceText: 'Upper left', x: 40, y: 40, width: 200, height: 40, style: {} },
    ],
  }
  let response = await fetch(`${base}/documents/${id}/scene`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scene),
  })
  assert.equal(response.status, 200)
  const savedDocument = await response.json()
  assert.deepEqual(
    savedDocument.scene.objects.slice().sort((left, right) => left.readingOrder - right.readingOrder).map(object => object.id),
    ['upper-left', 'upper-right', 'lower'],
  )
  assert.deepEqual(savedDocument.scene.pages[0].contentBounds, { x: 40, y: 40, width: 704, height: 1034 })
  assert.deepEqual(savedDocument.scene.pages[0].gridAvailableBounds, { width: 714, height: 1043 })
  assert.ok(savedDocument.report)

  response = await fetch(`${base}/documents`)
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
  assert.equal(savedSettings.aitunnelVerified, false)
  response = await fetch(`${base}/status`)
  const serviceStatus = await response.json()
  assert.equal(serviceStatus.aiProviderConfigured, true)
  assert.equal(serviceStatus.translationProviderConfigured, true)
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

test('administration persists the editable chat-agent prompt and restores its default', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-administration-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const createApp = () => {
    const app = express()
    app.use(express.json())
    app.use('/api/studio', createStudioRouter({
      rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python',
      runProcess: async () => ({ code: 1, stdout: '', stderr: 'not configured' }),
    }))
    app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
    return app
  }
  const firstBase = await listen(createApp(), t)

  let response = await fetch(`${firstBase}/administration`)
  assert.equal(response.status, 200)
  const defaults = await response.json()
  assert.match(defaults.chatAgentPrompt, /Отвечай чётко, понятно и по существу/)
  assert.match(defaults.chatAgentPrompt, /Ничего не додумывай/)
  assert.match(defaults.chatAgentPrompt, /конечном языке перевода/)
  assert.match(defaults.chatAgentPrompt, /задай один короткий уточняющий вопрос/)
  assert.match(defaults.chatAgentPrompt, /самостоятельно выбери только подходящие/)
  assert.match(defaults.chatAgentPrompt, /не включай в revisions/)
  assert.match(defaults.chatAgentPrompt, /Не выполняй попутное улучшение/)
  assert.equal(defaults.chatAgentPrompt, defaults.defaultChatAgentPrompt)

  response = await fetch(`${firstBase}/administration`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatAgentPrompt: 'Работай только с согласованной терминологией.' }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).chatAgentPrompt, 'Работай только с согласованной терминологией.')

  const secondBase = await listen(createApp(), t)
  response = await fetch(`${secondBase}/administration`)
  assert.equal((await response.json()).chatAgentPrompt, 'Работай только с согласованной терминологией.')
  response = await fetch(`${secondBase}/administration`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }),
  })
  assert.equal((await response.json()).chatAgentPrompt, defaults.defaultChatAgentPrompt)
})

test('ready AI instructions support persistent CRUD without automatic duplicates', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-instruction-presets-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const createApp = () => {
    const app = express()
    app.use(express.json())
    app.use('/api/studio', createStudioRouter({
      rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python',
      runProcess: async () => ({ code: 1, stdout: '', stderr: 'not configured' }),
    }))
    app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
    return app
  }
  const firstBase = await listen(createApp(), t)

  let response = await fetch(`${firstBase}/translation-instructions`)
  assert.deepEqual((await response.json()).presets, [])
  response = await fetch(`${firstBase}/translation-instructions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction: 'Все имена передавать транслитерацией.' }),
  })
  assert.equal(response.status, 201)
  const created = await response.json()
  assert.equal(created.created, true)
  assert.equal(Object.hasOwn(created.preset, 'title'), false)

  response = await fetch(`${firstBase}/translation-instructions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction: 'Все имена передавать транслитерацией.' }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).created, false)

  response = await fetch(`${firstBase}/translation-instructions/${created.preset.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction: 'Имена передавать транслитерацией по ISO 9.' }),
  })
  assert.equal(response.status, 200)
  const updated = (await response.json()).preset
  assert.equal(updated.instruction, 'Имена передавать транслитерацией по ISO 9.')

  const secondBase = await listen(createApp(), t)
  response = await fetch(`${secondBase}/translation-instructions`)
  const restored = await response.json()
  assert.equal(restored.presets.length, 1)
  assert.equal(restored.presets[0].instruction, 'Имена передавать транслитерацией по ISO 9.')

  response = await fetch(`${secondBase}/translation-instructions/${created.preset.id}`, { method: 'DELETE' })
  assert.equal(response.status, 204)
  response = await fetch(`${secondBase}/translation-instructions`)
  assert.deepEqual((await response.json()).presets, [])
})

test('equal source and target languages copy the recognized text without an AI request', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-same-language-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = '1'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Same language', filename: 'same-language.pdf', revision: 1, pageCount: 1, objectCount: 1,
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Same language', sourceLanguage: 'Turkish', targetLanguage: 'tr',
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'same-language-object', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'Vekaletname', translation: 'Старый перевод', confidence: 1,
      x: 40, y: 40, width: 200, height: 40,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [{ start: 0, end: 11, fontWeight: 700 }],
      translationTextStyles: [], originalBounds: { x: 40, y: 40, width: 200, height: 40 },
    }],
  }))
  let aiRequests = 0
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({
    rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python',
    runProcess: async (command, args) => {
      if (args?.[0] === 'exec') aiRequests += 1
      return { code: 0, stdout: 'Logged in', stderr: '' }
    },
  }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  const response = await fetch(`${base}/documents/${id}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectIds: ['same-language-object'], forceRetranslate: true }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  const object = result.scene.objects[0]
  assert.equal(aiRequests, 0)
  assert.equal(object.translation, object.sourceText)
  assert.deepEqual(object.translationTextStyles, object.sourceTextStyles)
  assert.equal(object.translationUnits[0].translation, object.translationUnits[0].sourceText)
  assert.equal(result.translated[0].source, 'source-copy')
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
  const entryId = (await response.json()).results[0].entry.id
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
  response = await fetch(`${base}/knowledge-base/entries/${entryId}`, { method: 'DELETE' })
  assert.equal(response.status, 204)
  response = await fetch(`${base}/documents/${id}`)
  const synchronizedObject = (await response.json()).scene.objects[0]
  assert.deepEqual(synchronizedObject.translationUnits[0].knowledgeMatches, [])
  assert.equal(synchronizedObject.translationUnits[0].memorySuggestion, null)
  assert.equal(synchronizedObject.translationUnits[0].status, 'new')
  assert.equal(synchronizedObject.status, 'recognized')
})

test('document loading discovers a newly added Turkish match without overwriting the current translation', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-memory-refresh-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = '9'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Turkish memory refresh', filename: 'turkish.pdf', revision: 1, pageCount: 1, objectCount: 1,
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Turkish memory refresh', sourceLanguage: 'Turkish', targetLanguage: 'ru', knowledgeBaseMode: 'suggestions', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'notary-object', pageIndex: 0, type: 'text', readingOrder: 1, sourceText: 'MERSİN 4. NOTERLİĞİ', translation: 'Ч', confidence: 1,
      x: 40, y: 40, width: 260, height: 40, style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      originalBounds: { x: 40, y: 40, width: 260, height: 40 },
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
    body: JSON.stringify({
      sourceText: 'mersin 4. noterliği', translation: 'четвертая нотариальная контора г. мерсин', sourceLanguage: 'Turkish', targetLanguage: 'ru',
    }),
  })
  assert.equal(response.status, 201)
  response = await fetch(`${base}/documents/${id}`)
  assert.equal(response.status, 200)
  const refreshed = await response.json()
  const unit = refreshed.scene.objects[0].translationUnits[0]
  assert.equal(unit.translation, 'Ч')
  assert.deepEqual(unit.translationKnowledgeMatches, [])
  assert.equal(unit.knowledgeMatches[0].matchType, 'exact')
  assert.equal(unit.knowledgeMatches[0].translation, 'ЧЕТВЕРТАЯ НОТАРИАЛЬНАЯ КОНТОРА Г. МЕРСИН')
  assert.equal(unit.memorySuggestion.entryId, unit.knowledgeMatches[0].entryId)
  assert.equal(refreshed.metadata.revision, 2)

  response = await fetch(`${base}/documents/${id}`)
  assert.equal(response.status, 200)
  const unchanged = await response.json()
  assert.equal(unchanged.metadata.revision, 2)

  // A term can exist only in the translation: it must be found independently.
  response = await fetch(`${base}/knowledge-base/entries`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceText: 'Letter', translation: 'Ч', sourceLanguage: 'tr', targetLanguage: 'ru' }),
  })
  const translatedEntryId = (await response.json()).results[0].entry.id
  const withTarget = await (await fetch(`${base}/documents/${id}`)).json()
  assert.equal(withTarget.scene.objects[0].translationUnits[0].translationKnowledgeMatches[0].entryId, translatedEntryId)
  response = await fetch(`${base}/documents/${id}/scene`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withTarget.scene),
  })
  assert.equal(response.status, 200)
  const roundTrip = await (await fetch(`${base}/documents/${id}`)).json()
  assert.equal(roundTrip.scene.objects[0].translationUnits[0].translationKnowledgeMatches[0].entryId, translatedEntryId)
  await fetch(`${base}/knowledge-base/entries/${translatedEntryId}`, { method: 'DELETE' })
  const removed = await (await fetch(`${base}/documents/${id}`)).json()
  assert.deepEqual(removed.scene.objects[0].translationUnits[0].translationKnowledgeMatches, [])
  assert.equal(removed.scene.objects[0].translation, 'Ч')

  // Applying uses a fresh, correctly oriented lookup, even if the scene's hint is stale.
  const originalId = unit.knowledgeMatches[0].entryId
  response = await fetch(`${base}/documents/${id}/translate/apply-memory`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectId: 'notary-object', unitId: unit.id, entryId: originalId }),
  })
  assert.equal(response.status, 200)
  const applied = await response.json()
  assert.equal(applied.scene.objects[0].translation, 'ЧЕТВЕРТАЯ НОТАРИАЛЬНАЯ КОНТОРА Г. МЕРСИН')
  assert.equal(applied.scene.objects[0].translationUnits[0].translationKnowledgeMatches[0].entryId, originalId)
  await fetch(`${base}/knowledge-base/entries/${originalId}`, { method: 'DELETE' })
  response = await fetch(`${base}/documents/${id}/translate/apply-memory`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectId: 'notary-object', unitId: unit.id, entryId: originalId }),
  })
  assert.equal(response.status, 409)
})

test('priority knowledge-base mode preserves the independent AI variant and revises a matched term in context', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-priority-memory-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = 'c'.repeat(32)
  const directory = path.join(dataDir, id)
  const sourceText = 'SÜRELİDİR: Bu vekaletname 25/08/2026 tarihine kadar geçerlidir.'
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Priority memory', filename: 'priority.pdf', revision: 1, pageCount: 1, objectCount: 1,
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Priority memory', sourceLanguage: 'Turkish', targetLanguage: 'ru', knowledgeBaseMode: 'priority', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'priority-object', pageIndex: 0, type: 'text', readingOrder: 1, sourceText, translation: '', confidence: 1,
      x: 40, y: 40, width: 500, height: 50, style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      originalBounds: { x: 40, y: 40, width: 500, height: 50 },
    }],
  }))
  const prompts = []
  const runProcess = async (command, args) => {
    if (args[0] === 'login') return { code: 0, stdout: 'Logged in', stderr: '' }
    if (args[0] === 'exec') {
      const outputPath = args[args.indexOf('--output-last-message') + 1]
      const prompt = args.at(-1)
      prompts.push(prompt)
      const unitId = prompt.match(/"id":"([^"]+)"/)?.[1]
      const revised = prompt.includes('requiredTerms')
      await fs.promises.writeFile(outputPath, JSON.stringify({ translations: [{
        id: unitId,
        translatedText: revised ? 'ИМЕЕТ СРОК: доверенность действует до 25.08.2026.' : 'СРОЧНАЯ: доверенность действует до 25.08.2026.',
      }] }))
      return { code: 0, stdout: '', stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'unexpected command' }
  }
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({ rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python', runProcess }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)
  let response = await fetch(`${base}/knowledge-base/entries`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceText: 'SÜRELİDİR', translation: 'Имеет срок', sourceLanguage: 'Turkish', targetLanguage: 'ru' }),
  })
  assert.equal(response.status, 201)
  const entryId = (await response.json()).results[0].entry.id
  response = await fetch(`${base}/documents/${id}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectIds: ['priority-object'] }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  const unit = result.scene.objects[0].translationUnits[0]
  assert.equal(prompts.length, 2)
  assert.doesNotMatch(prompts[0], /Имеет срок/)
  assert.match(prompts[1], /"source":"Sürelidir","translation":"ИМЕЕТ СРОК"/)
  assert.equal(unit.knowledgeMatches[0].matchType, 'exact-fragment')
  assert.equal(sourceText.slice(unit.knowledgeMatches[0].start, unit.knowledgeMatches[0].end), 'SÜRELİDİR')
  assert.equal(unit.aiTranslation, 'СРОЧНАЯ: доверенность действует до 25.08.2026.')
  assert.equal(unit.translation, 'ИМЕЕТ СРОК: доверенность действует до 25.08.2026.')
  assert.equal(unit.activeTranslationSource, 'memory-revised')
  response = await fetch(`${base}/documents/${id}/translate/apply-memory`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectId: 'priority-object', unitId: unit.id, entryId: unit.knowledgeMatches[0].entryId }),
  })
  assert.equal(response.status, 200)
  const applied = await response.json()
  assert.equal(applied.source, 'memory-revised')
  assert.equal(applied.scene.objects[0].translationUnits[0].aiTranslation, unit.aiTranslation)
  const preservedTranslation = applied.scene.objects[0].translationUnits[0].translation
  response = await fetch(`${base}/knowledge-base/entries/${entryId}`, { method: 'DELETE' })
  assert.equal(response.status, 204)
  response = await fetch(`${base}/documents/${id}`)
  const synchronizedUnit = (await response.json()).scene.objects[0].translationUnits[0]
  assert.deepEqual(synchronizedUnit.knowledgeMatches, [])
  assert.equal(synchronizedUnit.memorySuggestion, null)
  assert.equal(synchronizedUnit.memoryEntryId, null)
  assert.equal(synchronizedUnit.activeTranslationSource, 'manual')
  assert.equal(synchronizedUnit.translation, preservedTranslation)
})

test('document loading removes orphaned knowledge-base highlights left by an earlier client', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-orphaned-memory-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = 'e'.repeat(32)
  const entryId = '0c82dccf-e3e0-4594-94eb-35430af8c205'
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Orphaned memory', filename: 'orphaned.pdf', revision: 1, pageCount: 1, objectCount: 1,
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Orphaned memory', sourceLanguage: 'Turkish', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'mersin-object', pageIndex: 0, type: 'text', readingOrder: 1, sourceText: 'MERSİN', translation: 'Мерсин', status: 'memory-applied',
      x: 40, y: 40, width: 200, height: 40, style: {}, originalBounds: { x: 40, y: 40, width: 200, height: 40 },
      translationUnits: [{
        id: 'mersin-unit', sourceText: 'MERSİN', separatorAfter: '', translation: 'Мерсин', status: 'memory-applied',
        activeTranslationSource: 'memory', memoryEntryId: entryId,
        memorySuggestion: { entryId, translation: 'Мерсин', score: 1, matchType: 'exact', targetLanguage: 'ru' },
        knowledgeMatches: [{
          id: `${entryId}:0:6:0`, entryId, glossaryId: '00000000-0000-4000-8000-000000000001', sourceText: 'mersin', translation: 'Мерсин',
          sourceLanguage: 'Turkish', targetLanguage: 'ru', start: 0, end: 6, score: 1, matchType: 'exact', fullSegment: true,
        }],
      }],
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

  const response = await fetch(`${base}/documents/${id}`)
  assert.equal(response.status, 200)
  const document = await response.json()
  const object = document.scene.objects[0]
  const unit = object.translationUnits[0]
  assert.deepEqual(unit.knowledgeMatches, [])
  assert.equal(unit.memorySuggestion, null)
  assert.equal(unit.memoryEntryId, null)
  assert.equal(unit.activeTranslationSource, 'manual')
  assert.equal(unit.translation, 'Мерсин')
  assert.equal(object.status, 'edited')
  assert.equal(document.metadata.revision, 2)
})

test('multiple selected segments are translated, persisted, and leave unselected segments untouched', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-machine-translation-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = 'd'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Machine translation test', filename: 'translation.pdf', revision: 1, pageCount: 1, objectCount: 3,
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Machine translation test', sourceLanguage: 'en', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [
      {
        id: 'object-machine-1', pageIndex: 0, type: 'text', readingOrder: 1, sourceText: 'A new source sentence.', translation: '', confidence: 1,
        x: 40, y: 40, width: 300, height: 40, style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
        originalBounds: { x: 40, y: 40, width: 300, height: 40 },
      },
      {
        id: 'object-machine-2', pageIndex: 0, type: 'text', readingOrder: 2, sourceText: 'A second source sentence.', translation: '', confidence: 1,
        x: 40, y: 90, width: 300, height: 40, style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
        originalBounds: { x: 40, y: 90, width: 300, height: 40 },
      },
      {
        id: 'object-unselected', pageIndex: 0, type: 'text', readingOrder: 3, sourceText: 'Do not translate me.', translation: '', confidence: 1,
        x: 40, y: 140, width: 300, height: 40, style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
        originalBounds: { x: 40, y: 140, width: 300, height: 40 },
      },
    ],
  }))
  let translationRun = 0
  const runProcess = async (command, args) => {
    if (args[0] === 'login') return { code: 0, stdout: 'Logged in', stderr: '' }
    if (args[0] === 'exec') {
      translationRun += 1
      const outputPath = args[args.indexOf('--output-last-message') + 1]
      const unitIds = [...args.at(-1).matchAll(/"id":"([^"]+)"/g)].map(match => match[1])
      await fs.promises.writeFile(outputPath, JSON.stringify({
        translations: unitIds.map((unitId, index) => ({
          id: unitId,
          translatedText: `${translationRun === 1 ? 'Перевод' : 'Новый перевод'} ${index + 1}.`,
        })),
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'unexpected command' }
  }
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({ rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python', runProcess }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  let response = await fetch(`${base}/documents/${id}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectIds: ['object-machine-1', 'object-machine-2'] }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.translated.length, 2)
  assert.equal(result.pending.length, 0)
  assert.equal(result.scene.objects[0].translation, 'Перевод 1.')
  assert.equal(result.scene.objects[1].translation, 'Перевод 2.')
  assert.equal(result.scene.objects[2].translation, '')
  assert.equal(result.scene.objects[0].translationUnits[0].translation, 'Перевод 1.')
  assert.equal(result.scene.objects[0].translationUnits[0].status, 'machine-translated')
  assert.equal(result.scene.objects[0].translatedSourceText, 'A new source sentence.')
  assert.equal(result.scene.objects[0].translatedSourceType, 'text')

  response = await fetch(`${base}/documents/${id}`)
  const persisted = await response.json()
  assert.equal(persisted.scene.objects[0].translation, 'Перевод 1.')
  assert.equal(persisted.scene.objects[1].translation, 'Перевод 2.')
  assert.equal(persisted.scene.objects[2].translation, '')

  const editedScene = structuredClone(persisted.scene)
  editedScene.objects[0].sourceText = 'An edited source sentence.'
  editedScene.objects[0].translation = ''
  editedScene.objects[0].translationUnits = []
  response = await fetch(`${base}/documents/${id}/scene`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editedScene),
  })
  assert.equal(response.status, 200)
  response = await fetch(`${base}/documents/${id}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectIds: ['object-machine-1'] }),
  })
  assert.equal(response.status, 200)
  const selective = await response.json()
  assert.equal(selective.translated.length, 1)
  assert.equal(selective.scene.objects[0].translation, 'Новый перевод 1.')
  assert.equal(selective.scene.objects[0].translatedSourceText, 'An edited source sentence.')
  assert.equal(selective.scene.objects[1].translation, 'Перевод 2.')

  response = await fetch(`${base}/documents/${id}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectIds: ['object-machine-1', 'object-machine-2'], forceRetranslate: true }),
  })
  assert.equal(response.status, 200)
  const repeated = await response.json()
  assert.equal(repeated.translated.length, 2)
  assert.equal(repeated.scene.objects[0].translation, 'Новый перевод 1.')
  assert.equal(repeated.scene.objects[1].translation, 'Новый перевод 2.')
  assert.equal(repeated.scene.objects[0].translationUnits[0].aiTranslation, 'Новый перевод 1.')
})

test('stamps, seals and signatures use the required translated service labels', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-service-translation-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = 'e'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Service translation test', filename: 'services.pdf', revision: 1, pageCount: 1, objectCount: 3,
  }))
  const object = (objectId, type, sourceText, y) => ({
    id: objectId, pageIndex: 0, type, readingOrder: y, sourceText, translation: '', confidence: 1,
    x: 40, y, width: 300, height: 40,
    style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
    originalBounds: { x: 40, y, width: 300, height: 40 },
  })
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Service translation test', sourceLanguage: 'tr', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [
      object('stamp-service', 'stamp', '18871 25 Ağustos 2023', 40),
      object('seal-service', 'seal', 'TÜRKİYE CUMHURİYETİ', 90),
      object('signature-service', 'signature', '', 140),
    ],
  }))
  const runProcess = async (command, args) => {
    if (args[0] === 'login') return { code: 0, stdout: 'Logged in', stderr: '' }
    if (args[0] === 'exec') {
      const outputPath = args[args.indexOf('--output-last-message') + 1]
      const prompt = args.at(-1)
      const unitIds = [...prompt.matchAll(/"id":"([^"]+)"/g)].map(match => match[1])
      assert.match(prompt, /"type":"stamp"/)
      assert.match(prompt, /"type":"seal"/)
      await fs.promises.writeFile(outputPath, JSON.stringify({ translations: [
        { id: unitIds[0], translatedText: '№ 18871, 25 августа 2023 года' },
        { id: unitIds[1], translatedText: '/Печать: Турецкая Республика/' },
      ] }))
      return { code: 0, stdout: '', stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'unexpected command' }
  }
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({ rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python', runProcess }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  const response = await fetch(`${base}/documents/${id}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectIds: ['stamp-service', 'seal-service', 'signature-service'] }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.translated.length, 3)
  assert.equal(result.scene.objects[0].translation, '/Штамп: № 18871, 25 августа 2023 года/')
  assert.equal(result.scene.objects[1].translation, '/Печать: Турецкая Республика/')
  assert.equal(result.scene.objects[2].translation, '/Подпись/')
  assert.equal(result.scene.objects[2].translationUnits.length, 0)
})

test('AI selects applicable translated segments, preserves omitted ones, and can exclude service objects', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-instruction-revision-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = '9'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Instruction revision', filename: 'instructions.pdf', revision: 1, pageCount: 1, objectCount: 5,
  }))
  const object = (objectId, type, sourceText, translation, unitId, y, translationInstruction = '') => ({
    id: objectId, pageIndex: 0, type, readingOrder: y, sourceText, translation, translationInstruction, confidence: 1,
    x: 40, y, width: 500, height: 40,
    style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
    originalBounds: { x: 40, y, width: 500, height: 40 },
    translationUnits: [{ id: unitId, sourceText, separatorAfter: '', translation, status: 'machine-translated', activeTranslationSource: 'ai' }],
  })
  const emptySeal = object('empty-seal-object', 'seal', '', '/Печать/', 'empty-seal-unit', 190)
  emptySeal.translationUnits = []
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Instruction revision', sourceLanguage: 'tr', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [
      object('person-object', 'text', 'John Smith vekildir.', 'Джон Смит является поверенным.', 'person-unit', 40, 'Имя передай как Иван Иванов'),
      object('stamp-object', 'stamp', '18871', '/Штамп: № 18871/', 'stamp-unit', 90),
      object('logo-object', 'logo', 'NEWMARK', 'NEWMARK', 'logo-unit', 140, 'Сохрани название бренда'),
      emptySeal,
      object('unrelated-object', 'text', 'Belge tarihi', 'Дата документа', 'unrelated-unit', 240),
    ],
  }))
  const prompts = []
  const runProcess = async (command, args) => {
    if (args[0] === 'login') return { code: 0, stdout: 'Logged in', stderr: '' }
    if (args[0] === 'exec') {
      const outputPath = args[args.indexOf('--output-last-message') + 1]
      const prompt = args.at(-1)
      prompts.push(prompt)
      await fs.promises.writeFile(outputPath, JSON.stringify({ revisions: [
        { id: 'person-unit', translatedText: 'Иван Иванов является поверенным.', excludeFromExport: false },
        { id: 'stamp-unit', translatedText: '№ 18871', excludeFromExport: true },
        { id: 'service:logo-object', translatedText: 'NEWMARK', excludeFromExport: false },
      ] }))
      return { code: 0, stdout: '', stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'unexpected command' }
  }
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({ rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python', runProcess }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  const response = await fetch(`${base}/documents/${id}/translate/revise`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'document', globalInstruction: 'Переведи имена. Все печати не включай в сборку.' }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(prompts.length, 1)
  assert.match(prompts[0], /Переведи имена\. Все печати не включай в сборку\./)
  assert.match(prompts[0], /Имя передай как Иван Иванов/)
  assert.match(prompts[0], /Сохрани название бренда/)
  assert.equal(result.scene.globalTranslationInstruction, 'Переведи имена. Все печати не включай в сборку.')
  assert.equal(result.scene.objects[0].translation, 'Иван Иванов является поверенным.')
  assert.equal(result.scene.objects[0].translationUnits[0].status, 'ai-revised')
  assert.equal(result.scene.objects[1].excluded, true)
  assert.equal(result.scene.objects[2].translation, 'NEWMARK')
  assert.equal(result.scene.objects[2].status, 'ai-revised')
  assert.equal(result.scene.objects[3].translation, '/Печать/')
  assert.equal(result.scene.objects[3].status, 'recognized')
  assert.equal(result.scene.objects[4].translation, 'Дата документа')
  assert.equal(result.scene.objects[4].status, 'recognized')
  assert.equal(result.excluded[0], 'stamp-object')
  assert.equal(result.scene.instructionRevision.objectCount, 3)
  assert.equal(result.scene.instructionRevision.excludedCount, 1)
})

test('segment AI chat persists both sides and does not change translation before clarification', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-segment-chat-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = '7'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Chat clarification', filename: 'chat.pdf', revision: 1, pageCount: 1, objectCount: 1,
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Chat clarification', sourceLanguage: 'tr', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'chat-object', pageIndex: 0, type: 'text', readingOrder: 1, sourceText: 'Madde 1', translation: 'Пункт 1', confidence: 1,
      x: 40, y: 40, width: 500, height: 40,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      originalBounds: { x: 40, y: 40, width: 500, height: 40 },
      translationUnits: [{ id: 'chat-unit', sourceText: 'Madde 1', separatorAfter: '', translation: 'Пункт 1', status: 'machine-translated', activeTranslationSource: 'ai' }],
    }],
  }))
  const chatPrompts = []
  const runProcess = async (command, args) => {
    if (args[0] === 'login') return { code: 0, stdout: 'Logged in', stderr: '' }
    if (args[0] === 'exec') {
      const outputPath = args[args.indexOf('--output-last-message') + 1]
      chatPrompts.push(args.at(-1))
      await fs.promises.writeFile(outputPath, JSON.stringify({
        assistantMessage: 'Какую именно маркировку нужно убрать?',
        needsClarification: true,
        revisions: [],
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'unexpected command' }
  }
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({ rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python', runProcess }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  const response = await fetch(`${base}/documents/${id}/translate/revise`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objectIds: ['chat-object'],
      scope: 'selection',
      revisionInstruction: 'Убери маркировку',
      chatTarget: { kind: 'segment', objectId: 'chat-object' },
    }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.match(chatPrompts[0], /Отвечай чётко, понятно и по существу/)
  assert.match(chatPrompts[0], /Работай только с текстом конечного языка перевода/)
  assert.match(chatPrompts[0], /самостоятельно выбери только подходящие/)
  assert.equal(result.needsClarification, true)
  assert.deepEqual(result.revised, [])
  assert.equal(result.scene.objects[0].translation, 'Пункт 1')
  assert.equal(result.scene.objects[0].translationInstruction, '')
  assert.deepEqual(result.scene.objects[0].revisionChat.map(message => [message.role, message.text]), [
    ['user', 'Убери маркировку'],
    ['assistant', 'Какую именно маркировку нужно убрать?'],
  ])
})

test('mass AI chat shows one assistant response when the document uses several batches', async t => {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-chat-batches-'))
  t.after(() => fs.promises.rm(dataDir, { recursive: true, force: true }))
  const id = '6'.repeat(32)
  const directory = path.join(dataDir, id)
  await fs.promises.mkdir(directory)
  await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({
    id, title: 'Chat batches', filename: 'batches.pdf', revision: 1, pageCount: 1, objectCount: 21,
  }))
  const style = { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' }
  const objects = Array.from({ length: 21 }, (_, index) => ({
    id: `batch-object-${index + 1}`, pageIndex: 0, type: 'logo', readingOrder: index + 1,
    sourceText: `Logo ${index + 1}`, translation: `Логотип ${index + 1}`, confidence: 1,
    x: 40, y: 40 + index * 4, width: 300, height: 30, style, originalBounds: { x: 40, y: 40 + index * 4, width: 300, height: 30 },
  }))
  await fs.promises.writeFile(path.join(directory, 'scene.json'), JSON.stringify({
    documentId: id, title: 'Chat batches', sourceLanguage: 'en', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, sourceWidth: 794, sourceHeight: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects,
  }))
  let batchNumber = 0
  const runProcess = async (command, args) => {
    if (args[0] === 'login') return { code: 0, stdout: 'Logged in', stderr: '' }
    if (args[0] === 'exec') {
      batchNumber += 1
      const outputPath = args[args.indexOf('--output-last-message') + 1]
      const ids = [...args.at(-1).matchAll(/"id":"(service:[^"]+)"/g)].map(match => match[1])
      await fs.promises.writeFile(outputPath, JSON.stringify({
        assistantMessage: batchNumber === 1 ? 'Круги перед текстом удалены.' : 'Круги перед текстом убраны.',
        needsClarification: false,
        revisions: ids.map(itemId => ({ id: itemId, translatedText: `Исправлено ${itemId}`, excludeFromExport: false })),
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'unexpected command' }
  }
  const app = express()
  app.use(express.json())
  app.use('/api/studio', createStudioRouter({ rootDir: path.resolve(__dirname, '..'), dataDir, pythonBin: 'python', runProcess }))
  app.use((error, request, response, next) => response.status(error.status || 500).json({ error: error.message }))
  const base = await listen(app, t)

  const response = await fetch(`${base}/documents/${id}/translate/revise`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'document', objectIds: [], revisionInstruction: 'Убери круги', chatTarget: { kind: 'batch' } }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(batchNumber, 2)
  assert.equal(result.assistantMessage, 'Круги перед текстом удалены.')
  assert.equal(result.scene.batchRevisionChat.at(-1).text, 'Круги перед текстом удалены.')
  assert.doesNotMatch(result.scene.batchRevisionChat.at(-1).text, /убраны/)
})
