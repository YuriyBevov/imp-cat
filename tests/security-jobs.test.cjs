const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
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
})

test('job manager reports queued work, monotonic progress and a safe completed result', async () => {
  const manager = createJobManager({ concurrency: 1 })
  const created = manager.enqueue({
    kind: 'document-analysis',
    title: 'contract.pdf',
    documentId: 'a'.repeat(32),
    task: async update => {
      update({ stage: 'rendering', progress: 15, message: 'Rendering' })
      await new Promise(resolve => setTimeout(resolve, 10))
      update({ stage: 'analysis', progress: 70, message: 'Analysis' })
      update({ progress: 40 })
      return { documentId: 'a'.repeat(32), message: '4 pages' }
    },
  })
  assert.equal(created.status, 'queued')
  assert.equal('task' in created, false)
  const completed = await waitFor(() => {
    const job = manager.get(created.id)
    return job?.status === 'completed' ? job : null
  })
  assert.equal(completed.progress, 100)
  assert.equal(completed.documentId, 'a'.repeat(32))
  assert.equal(completed.message, '4 pages')
})
