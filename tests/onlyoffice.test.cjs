const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  buildOnlyOfficeConfig,
  isDocxBuffer,
  isValidDocumentId,
  rewriteDownloadUrl,
  sanitizeDocxFilename,
  signJwt,
} = require('../lib/onlyoffice.cjs')

const id = '1234567890abcdef1234567890abcdef'

test('sanitizes uploaded DOCX names and validates opaque IDs', () => {
  assert.equal(sanitizeDocxFilename(encodeURIComponent('../Тест: файл.docx')), 'Тест- файл.docx')
  assert.equal(sanitizeDocxFilename('report'), 'report.docx')
  assert.equal(isValidDocumentId(id), true)
  assert.equal(isValidDocumentId('../document'), false)
})

test('recognizes ZIP-based DOCX payloads', () => {
  assert.equal(isDocxBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04])), true)
  assert.equal(isDocxBuffer(Buffer.from('not a document')), false)
})

test('builds a signed self-hosted ONLYOFFICE configuration', () => {
  const config = buildOnlyOfficeConfig({
    id,
    filename: 'Исходник.docx',
    revision: 4,
    appInternalUrl: 'http://host.docker.internal:3100/',
    jwtSecret: 'test-secret',
  })
  assert.equal(config.document.key, `icat-${id}-r4`)
  assert.equal(config.document.url, `http://host.docker.internal:3100/api/onlyoffice/documents/${id}/source?revision=4`)
  assert.equal(config.editorConfig.callbackUrl, `http://host.docker.internal:3100/api/onlyoffice/documents/${id}/callback`)
  assert.equal(config.editorConfig.customization.forcesave, true)
  assert.equal(config.token.split('.').length, 3)
  assert.equal(signJwt({ value: 1 }, 'secret', 100).split('.').length, 3)
})

test('rewrites container download URLs to an address reachable by ICAT', () => {
  assert.equal(
    rewriteDownloadUrl('http://document-server/cache/files/result.docx?md5=abc', 'http://127.0.0.1:8080'),
    'http://127.0.0.1:8080/cache/files/result.docx?md5=abc'
  )
})

test('ships an isolated ONLYOFFICE POC page and compose service', () => {
  const root = path.resolve(__dirname, '..')
  const html = fs.readFileSync(path.join(root, 'public/onlyoffice.html'), 'utf8')
  const client = fs.readFileSync(path.join(root, 'public/onlyoffice.js'), 'utf8')
  const styles = fs.readFileSync(path.join(root, 'public/onlyoffice.css'), 'utf8')
  const compose = fs.readFileSync(path.join(root, 'docker-compose.onlyoffice.yml'), 'utf8')
  assert.match(html, /id="onlyoffice-editor"/)
  assert.match(html, /class="editor-shell"/)
  assert.match(client, /DocsAPI\.DocEditor/)
  assert.match(client, /\/api\/onlyoffice\/documents/)
  assert.match(compose, /onlyoffice\/documentserver:latest/)
  assert.match(compose, /host\.docker\.internal:host-gateway/)
  assert.match(styles, /\.editor-panel[\s\S]*display: flex;[\s\S]*height: calc\(100dvh - 124px\)/)
  assert.match(styles, /\.editor-shell[\s\S]*flex: 1 1 auto;[\s\S]*min-height: 620px/)
  assert.match(styles, /\.editor-shell > #onlyoffice-editor[\s\S]*position: absolute !important;[\s\S]*height: 100% !important/)
})
