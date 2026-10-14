const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { withPrivacyScope, guardProviderRequest, trustPrivacyPrompt } = require('../lib/privacy-outbound.cjs')
const { dragRegion } = require('../public/privacy-view.js')

const endpoint = 'https://privacy-provider.invalid/v1/chat/completions'
const request = content => ({ method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content }] }) })

test('privacy boundary rejects unapproved text, images, protocols and revoked approvals', async () => {
  await withPrivacyScope({ required: true }, async () => {
    await assert.rejects(guardProviderRequest(endpoint, request('secret')), /заблокирована/)
  })
  await withPrivacyScope({ required: true, outboundApproved: true, provider: 'aitunnel',
    approvedTexts: new Set(['Approved text']), imageHashes: new Set() }, async () => {
    for (const value of [{ text: 'Private name' }, { arbitrary: 'Private name' }]) {
      await assert.rejects(guardProviderRequest(endpoint, request(JSON.stringify(value))), /заблокирован/)
    }
    await assert.rejects(guardProviderRequest(endpoint, request([{ type: 'image_url', image_url: { url: 'https://private.test/image' } }])), /изображения/)
    await assert.rejects(guardProviderRequest(endpoint, request([{ type: 'input_audio', data: 'secret' }])), /тип содержимого/)
    await assert.rejects(guardProviderRequest(endpoint.replace('chat/completions', 'embeddings'), request('x')), /embeddings/)
    const valid = await guardProviderRequest(endpoint, request(JSON.stringify({ text: 'Approved text' })))
    assert.ok(valid.options.body.includes('Approved text'))
  })
  await withPrivacyScope({ required: true, outboundApproved: true, provider: 'aitunnel', assertCurrent: () => { throw new Error('Revoked') } }, async () => {
    await assert.rejects(guardProviderRequest(endpoint, request(trustPrivacyPrompt('Static'))), /Revoked/)
  })
})

test('privacy references are opaque to provider and decoded in JSON reply', async () => {
  await withPrivacyScope({ required: true, outboundApproved: true, provider: 'aitunnel', approvedTexts: new Set(['Safe']) }, async () => {
    const guarded = await guardProviderRequest(endpoint, request(JSON.stringify({ segments: [{ id: 'Alice-private-id', type: 'text', sourceText: 'Safe' }] })))
    assert.ok(!guarded.options.body.includes('Alice-private-id'))
    const sent = JSON.parse(JSON.parse(guarded.options.body).messages[0].content)
    assert.match(sent.segments[0].id, /^REF_/)
    const decoded = guarded.decode({ choices: [{ message: { content: JSON.stringify([{ id: sent.segments[0].id, translatedText: 'Safe' }]) } }] })
    assert.equal(JSON.parse(decoded.choices[0].message.content)[0].id, 'Alice-private-id')
  })
})

test('manual masks are clamped to page and tiny drags are rejected', () => {
  assert.deepEqual(dragRegion({ x: 300, y: 500 }, { x: -20, y: -10 }, { index: 2, width: 200, height: 400 }), { page: 2, box: [0, 0, 200, 400] })
  assert.equal(dragRegion({ x: 0, y: 0 }, { x: 1, y: 1 }, { index: 0, width: 100, height: 100 }), null)
})

function runProcess(command, args, timeout, options = {}) {
  if (command === 'codex') return Promise.resolve({ code: 1, stdout: '', stderr: 'Unavailable in synthetic test' })
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { signal: options.signal || undefined })
    let stdout = '', stderr = ''
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}

test('real local privacy HTTP workflow protects analysis, edits, translation and export',
  { skip: process.env.ICAT_PRIVACY_INTEGRATION_TEST !== '1', timeout: 180000 }, async t => {
    const rootDir = path.resolve(__dirname, '..')
    const python = path.join(rootDir, '.venv/bin/python')
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'icat-private-http-'))
    t.after(() => fs.rm(temporary, { recursive: true, force: true }))
    const source = path.join(temporary, 'synthetic.pdf')
    assert.equal((await runProcess(python, ['-c', 'import pymupdf,sys; d=pymupdf.open(); p=d.new_page(); p.insert_text((45,80),"Name: Alice Example\\nEmail: alice@example.test",fontsize=18); d.save(sys.argv[1])', source])).code, 0)
    const environment = { AI_PROVIDER: 'aitunnel', TRANSLATION_API_URL: endpoint, TRANSLATION_API_KEY: 'synthetic-key', TRANSLATION_MODEL: 'synthetic-model', DATABASE_URL: '', AI_DNS_SERVERS: '' }
    const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
    Object.assign(process.env, environment)
    t.after(() => { for (const key of Object.keys(environment)) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key] })
    const nativeFetch = globalThis.fetch
    const sent = []
    let tokens = []
    let omitTokens = false
    globalThis.fetch = async (url, options = {}) => {
      if (!String(url).startsWith('https://privacy-provider.invalid')) return nativeFetch(url, options)
      const body = JSON.parse(options.body)
      sent.push(body)
      const image = body.messages.some(message => Array.isArray(message.content) && message.content.some(item => item.type === 'image_url'))
      let result
      if (image && body.messages[0].content.includes('корректор макета')) result = { summary: 'Synthetic review', pages: [{ pageIndex: 0, similarity: .95, findings: [], adjustments: [] }] }
      else if (image) result = { documentTitle: 'Synthetic', languages: ['en'], pages: [{ pageIndex: 0, languages: ['en'], tables: [], segments: [{ segmentId: 'synthetic', type: 'text', sourceText: 'Name: ' + (omitTokens ? 'Omitted placeholders' : tokens.join('\n')), regions: [{ x: .1, y: .1, width: .7, height: .2 }], style: {} }] }] }
      else {
        const data = JSON.parse(body.messages.at(-1).content)
        if (data.segment) result = { action: 'none', assistantMessage: 'No changes', segments: [] }
        else if (data.globalInstruction !== undefined) result = { assistantMessage: 'Updated', needsClarification: false, revisions: data.segments.map(item => ({ id: item.id, translatedText: item.currentTranslation, excludeFromExport: false })) }
        else result = data.segments.map(item => ({ id: item.id, translatedText: item.text || item.sourceText }))
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    t.after(() => { globalThis.fetch = nativeFetch })
    const express = require('express')
    const { createStudioRouter } = require('../lib/studio.cjs')
    const app = express()
    app.use(express.json())
    app.use('/api/studio', createStudioRouter({ rootDir, dataDir: path.join(temporary, 'studio'), pythonBin: python,
      privacyRequired: true, privacyKeyPath: path.join(temporary, 'keys/privacy.key'), runProcess }))
    app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }))
    const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
    t.after(() => new Promise(resolve => server.close(resolve)))
    const base = `http://127.0.0.1:${server.address().port}/api/studio`
    const call = async (route, body, headers = {}) => nativeFetch(base + route, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
    const wait = async jobId => {
      for (let i = 0; i < 700; i++) {
        const { job } = await (await call('/jobs/' + jobId)).json()
        if (['completed', 'failed', 'cancelled'].includes(job.status)) { assert.equal(job.status, 'completed', job.error?.message || JSON.stringify(job.error)); return job }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      assert.fail('Synthetic job timed out')
    }
    let response = await nativeFetch(base + '/jobs', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'Alice-private-filename.pdf' }, body: await fs.readFile(source) })
    assert.equal(response.status, 202)
    const upload = (await response.json()).job
    const id = upload.documentId
    await wait(upload.id)
    assert.equal((await call(`/documents/${id}/analysis-jobs`, { rotations: [0] })).status, 409)
    assert.equal(sent.length, 0)
    response = await call(`/documents/${id}/privacy/prepare`, { language: 'en', rotations: [0], regions: [{ page: 0, box: [-100, 0, 5, 10] }] })
    const failedJob = (await response.json()).job
    for (let i = 0; i < 100; i++) {
      if ((await (await call('/jobs/' + failedJob.id)).json()).job.status === 'failed') break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal((await (await call(`/documents/${id}/privacy`)).json()).phase, 'failed')
    response = await call(`/documents/${id}/privacy/prepare`, { language: 'en', rotations: [0], knownValues: ['Alice Example', 'alice@example.test'] })
    assert.equal(response.status, 202)
    await wait((await response.json()).job.id)
    const review = await (await call(`/documents/${id}/privacy`)).json()
    tokens = review.entities.map(item => item.token)
    assert.ok(tokens.length >= 2)
    assert.ok(review.pages[0].masks.every(mask => mask.labelRendered))
    assert.equal(sent.length, 0)
    const approveBody = { generation: review.generation, reviewed: true, replacements: Object.fromEntries(review.entities.map(item => [item.token, item.replacement])) }
    assert.equal((await call(`/documents/${id}/privacy/approve`, { ...approveBody, reviewed: false })).status, 500)
    response = await call(`/documents/${id}/privacy/approve`, approveBody)
    assert.equal(response.status, 200, await response.text())
    response = await call(`/documents/${id}/analysis-jobs`, { rotations: [0] })
    assert.equal(response.status, 202, await response.clone().text())
    await wait((await response.json()).job.id)
    const imagePayload = sent[0].messages.flatMap(message => Array.isArray(message.content) ? message.content : []).find(item => item.type === 'image_url').image_url.url
    const cleanImage = await fs.readFile(path.join(temporary, 'studio', id, 'privacy', review.generation, 'page-001.png'))
    assert.equal(crypto.createHash('sha256').update(Buffer.from(imagePayload.split(',')[1], 'base64')).digest('hex'), crypto.createHash('sha256').update(cleanImage).digest('hex'))
    assert.ok(!JSON.stringify(sent).includes('Alice-private-filename'))
    let document = await (await call(`/documents/${id}`)).json()
    let objectId = document.scene.objects[0].id
    response = await call(`/documents/${id}/translate`, { objectIds: [objectId], targetLanguage: 'ru' })
    if (response.status === 409) {
      const challenge = (await response.json()).privacyReview
      assert.ok(challenge)
      assert.equal((await call(`/documents/${id}/privacy/outbound/${challenge.token}`, { reviewed: true, digest: challenge.digest })).status, 200)
      response = await call(`/documents/${id}/translate`, { objectIds: [objectId], targetLanguage: 'ru' }, { 'X-Privacy-Approval': challenge.token })
    }
    assert.equal(response.status, 200, await response.clone().text())
    const beforeEdit = sent.length
    response = await call(`/documents/${id}/source/revise`, { objectId, instruction: 'Mention bob@example.test' })
    assert.equal(response.status, 409)
    const challenge = (await response.json()).privacyReview
    assert.ok(challenge.texts.every(text => !text.includes('bob@example.test')))
    assert.equal(sent.length, beforeEdit)
    assert.equal((await call(`/documents/${id}/privacy/outbound/${challenge.token}`, { reviewed: true, digest: 'stale' })).status, 500)
    assert.equal((await call(`/documents/${id}/privacy/outbound/${challenge.token}`, { reviewed: true, digest: challenge.digest })).status, 200)
    assert.equal((await call(`/documents/${id}/source/revise`, { objectId, instruction: 'Changed' }, { 'X-Privacy-Approval': challenge.token })).status, 409)
    response = await call(`/documents/${id}/source/revise`, { objectId, instruction: 'Mention bob@example.test' }, { 'X-Privacy-Approval': challenge.token })
    assert.equal(response.status, 200, await response.clone().text())
    assert.ok(!JSON.stringify(sent).includes('bob@example.test'))
    assert.ok(!JSON.stringify(sent).includes('alice@example.test'))
    assert.ok(!JSON.stringify(sent).includes('Alice Example'))
    response = await call(`/documents/${id}/source/revise`, { objectId, instruction: 'Insert local_secret_value' })
    const manualChallenge = (await response.json()).privacyReview
    assert.ok(manualChallenge)
    response = await call(`/documents/${id}/privacy/outbound/${manualChallenge.token}`, { knownValues: ['local_secret_value'] })
    const maskedChallenge = await response.json()
    assert.equal(maskedChallenge.approved, false)
    assert.ok(maskedChallenge.texts.every(text => !text.includes('local_secret_value')))
    assert.equal((await call(`/documents/${id}/privacy/outbound/${manualChallenge.token}`, { reviewed: true, digest: maskedChallenge.digest })).status, 200)
    assert.equal((await call(`/documents/${id}/source/revise`, { objectId, instruction: 'Insert local_secret_value' }, { 'X-Privacy-Approval': manualChallenge.token })).status, 200)
    assert.ok(!JSON.stringify(sent).includes('local_secret_value'))
    response = await call(`/documents/${id}/agent/layout-review`, {})
    if (response.status === 409) {
      const challenge = (await response.json()).privacyReview
      assert.ok(challenge)
      assert.equal((await call(`/documents/${id}/privacy/outbound/${challenge.token}`, { reviewed: true, digest: challenge.digest })).status, 200)
      response = await call(`/documents/${id}/agent/layout-review`, {}, { 'X-Privacy-Approval': challenge.token })
    }
    assert.equal(response.status, 202, await response.clone().text())
    await wait((await response.json()).job.id)
    response = await call(`/documents/${id}/export`, { format: 'docx' })
    assert.equal(response.status, 200, await response.clone().text())
    const restored = path.join(temporary, 'restored.docx')
    await fs.writeFile(restored, Buffer.from(await response.arrayBuffer()))
    const exported = await runProcess(python, ['-c', 'from docx import Document; import sys; s="\\n".join(p.text for p in Document(sys.argv[1]).paragraphs); assert "Alice Example" in s; assert "ICATPII_" not in s', restored])
    assert.equal(exported.code, 0, exported.stderr)
    const directory = path.join(temporary, 'studio', id)
    assert.ok(!(await fs.readdir(path.join(directory, 'exports'))).some(name => name.startsWith('.')))
    response = await call(`/documents/${id}/export`, { format: 'docx', restorePrivateData: false })
    assert.equal(response.status, 200)
    await fs.writeFile(restored, Buffer.from(await response.arrayBuffer()))
    assert.equal((await runProcess(python, ['-c', 'from docx import Document; import sys; s="\\n".join(p.text for p in Document(sys.argv[1]).paragraphs); assert "ICATPII_" in s; assert "Alice Example" not in s', restored])).code, 0)
    assert.equal((await fs.stat(path.join(directory, 'privacy', review.generation, 'vault.enc'))).mode & 0o777, 0o600)
    assert.equal((await fs.stat(directory)).mode & 0o777, 0o700)
    assert.equal((await fs.stat(path.join(temporary, 'keys/privacy.key'))).mode & 0o777, 0o600)
    const checkpointName = (await fs.readdir(directory)).find(file => file.startsWith('agent-analysis-batch-'))
    const checkpoint = JSON.parse(await fs.readFile(path.join(directory, checkpointName), 'utf8'))
    assert.equal(checkpoint.analysis, null)
    assert.match(checkpoint.privacySnapshot, /^[a-f0-9]{32}$/)
    const beforeCachedAnalysis = sent.length
    response = await call(`/documents/${id}/agent/reanalyze`, { rotations: [0] })
    if (response.status === 409) {
      const challenge = (await response.json()).privacyReview
      assert.ok(challenge)
      await call(`/documents/${id}/privacy/outbound/${challenge.token}`, { reviewed: true, digest: challenge.digest })
      response = await call(`/documents/${id}/agent/reanalyze`, { rotations: [0] }, { 'X-Privacy-Approval': challenge.token })
    }
    assert.equal(response.status, 200, await response.clone().text())
    objectId = (await response.json()).scene.objects[0].id
    assert.equal(sent.length, beforeCachedAnalysis)
    const encryptedCheckpoint = path.join(directory, 'privacy', `snapshot-${checkpoint.privacySnapshot}.enc`)
    const checkpointBytes = await fs.readFile(encryptedCheckpoint)
    await fs.writeFile(encryptedCheckpoint, Buffer.from('Corrupted authenticated checkpoint'))
    response = await call(`/documents/${id}/agent/reanalyze`, { rotations: [0] })
    assert.equal(response.status, 500)
    assert.equal(sent.length, beforeCachedAnalysis)
    await fs.writeFile(encryptedCheckpoint, checkpointBytes)
    for (const file of await fs.readdir(directory)) if (file.startsWith('agent-analysis-batch-')) await fs.rm(path.join(directory, file))
    omitTokens = true
    response = await call(`/documents/${id}/agent/reanalyze`, { rotations: [0] })
    if (response.status === 409) {
      const challenge = (await response.json()).privacyReview
      assert.ok(challenge)
      await call(`/documents/${id}/privacy/outbound/${challenge.token}`, { reviewed: true, digest: challenge.digest })
      response = await call(`/documents/${id}/agent/reanalyze`, { rotations: [0] }, { 'X-Privacy-Approval': challenge.token })
    }
    assert.equal(response.status, 422, await response.clone().text())
    assert.equal((await (await call(`/documents/${id}`)).json()).scene.objects[0].id, objectId)
    assert.ok(!JSON.stringify(sent).includes('Alice Example'))
    assert.ok(!JSON.stringify(sent).includes('alice@example.test'))
    const beforeRecovery = sent.length
    await fs.rm(path.join(directory, 'preparation.json'))
    response = await call(`/documents/${id}/preparation`)
    assert.equal(response.status, 200, await response.clone().text())
    assert.equal(sent.length, beforeRecovery)
    assert.equal((await (await call(`/documents/${id}`)).json()).scene.objects[0].id, objectId)
    await fs.appendFile(path.join(directory, 'source.pdf'), '\nchanged')
    assert.equal((await call(`/documents/${id}/translate`, { targetLanguage: 'ru' })).status, 500)
  })
