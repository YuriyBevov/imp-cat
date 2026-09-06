const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createCredentialVault } = require('../lib/credential-vault.cjs')
const { createJobManager } = require('../lib/job-manager.cjs')

function waitFor(predicate, timeoutMs = 2_000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const inspect = () => {
      const value = predicate()
      if (value) return resolve(value)
      if (Date.now() - startedAt > timeoutMs) return reject(new Error('Timeout'))
      setTimeout(inspect, 5)
    }
    inspect()
  })
}

test('credential vault decrypts a browser-compatible RSA-OAEP payload without exposing the secret in status', () => {
  const vault = createCredentialVault()
  const secret = 'aitunnel-test-secret-123'
  const ciphertext = crypto.publicEncrypt({
    key: vault.publicKeyPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  }, Buffer.from(secret)).toString('base64')

  vault.setEncrypted(ciphertext)
  assert.equal(vault.getSecret(), secret)
  assert.deepEqual(Object.keys(vault.status()).sort(), ['configured', 'source', 'updatedAt'])
  assert.equal(JSON.stringify(vault.status()).includes(secret), false)
  assert.equal(vault.status().source, 'session')
  vault.clearSession()
  assert.equal(vault.getSecret(), '')
})

test('credential vault falls back to a local environment secret after a session key is removed', () => {
  const vault = createCredentialVault({ environmentSecret: 'environment-only-secret' })
  assert.equal(vault.getSecret(), 'environment-only-secret')
  assert.equal(vault.status().source, 'environment')
  vault.clearSession()
  assert.equal(vault.getSecret(), 'environment-only-secret')
  vault.setEnvironmentSecret('rotated-environment-secret')
  assert.equal(vault.getSecret(), 'rotated-environment-secret')
})

test('job manager reports queued work, monotonic progress and a safe completed result', async () => {
  const manager = createJobManager({ concurrency: 1 })
  const created = manager.enqueue({
    kind: 'document-analysis',
    title: 'contract.pdf',
    documentId: 'a'.repeat(32),
    provider: 'aitunnel',
    model: 'vision-model',
    task: async update => {
      update({ stage: 'rendering', progress: 15, message: 'Rendering' })
      await new Promise(resolve => setTimeout(resolve, 10))
      update({ stage: 'analysis', progress: 70, message: 'Analysis' })
      update({ progress: 40 })
      return { documentId: 'a'.repeat(32), message: '4 pages' }
    },
  })
  assert.equal(created.status, 'queued')
  assert.equal(created.provider, 'aitunnel')
  assert.equal(created.model, 'vision-model')
  assert.equal('task' in created, false)
  const completed = await waitFor(() => {
    const job = manager.get(created.id)
    return job?.status === 'completed' ? job : null
  })
  assert.equal(completed.progress, 100)
  assert.equal(completed.documentId, 'a'.repeat(32))
  assert.equal(completed.message, '4 pages')
})

test('job manager cancels a running task through AbortSignal', async () => {
  const manager = createJobManager({ concurrency: 1 })
  manager.register('document-analysis', async (payload, update, { signal }) => {
    update({ stage: 'analysis', progress: 30, message: 'Analysis', details: { totalPages: 4, processedPages: 1 } })
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  })
  const created = manager.enqueue({ kind: 'document-analysis', title: 'contract.pdf', payload: { documentId: 'b'.repeat(32) } })
  await waitFor(() => manager.get(created.id)?.status === 'running')
  manager.cancel(created.id)
  const cancelled = await waitFor(() => manager.get(created.id)?.status === 'cancelled' ? manager.get(created.id) : null)
  assert.equal(cancelled.message, 'Задание отменено пользователем')
  assert.equal(cancelled.details.totalPages, 4)
})

test('job manager restores and resumes a persisted running task after server restart', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-jobs-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  const storagePath = path.join(directory, 'jobs.json')
  const id = 'c'.repeat(32)
  await fs.promises.writeFile(storagePath, JSON.stringify({
    version: 1,
    jobs: [{
      id, kind: 'document-analysis', title: 'restored.pdf', status: 'running', stage: 'analysis', progress: 40,
      message: 'Interrupted', documentId: 'd'.repeat(32), resumable: true,
      payload: { documentId: 'd'.repeat(32), filename: 'restored.pdf' },
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:01:00.000Z',
    }],
  }))
  const manager = createJobManager({ concurrency: 1, storagePath })
  const restored = manager.get(id)
  assert.equal(restored.status, 'queued')
  assert.equal(restored.recovered, true)
  manager.register('document-analysis', async payload => ({
    documentId: payload.documentId, message: `Resumed ${payload.filename}`, details: { totalPages: 3 },
  }))
  const completed = await waitFor(() => manager.get(id)?.status === 'completed' ? manager.get(id) : null)
  assert.equal(completed.documentId, 'd'.repeat(32))
  assert.equal(completed.message, 'Resumed restored.pdf')
  assert.equal(completed.details.totalPages, 3)
})
