const crypto = require('node:crypto')
const path = require('node:path')

const DOCUMENT_ID_PATTERN = /^[0-9a-f]{32}$/

function sanitizeDocxFilename(value) {
  let decoded = String(value || 'document.docx')
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // Keep the original header value if it was not URI encoded.
  }

  const basename = path.basename(decoded)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim()
  const stem = basename.replace(/\.docx$/i, '').trim() || 'document'
  return `${stem.slice(0, 180)}.docx`
}

function isValidDocumentId(value) {
  return DOCUMENT_ID_PATTERN.test(String(value || ''))
}

function isDocxBuffer(value) {
  return Buffer.isBuffer(value) && value.length >= 4 && value[0] === 0x50 && value[1] === 0x4b
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function signJwt(payload, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify({ ...payload, iat: nowSeconds, exp: nowSeconds + 60 * 10 }))
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function buildOnlyOfficeConfig({
  id,
  filename,
  revision,
  appInternalUrl,
  jwtSecret,
}) {
  if (!isValidDocumentId(id)) throw new Error('Invalid ONLYOFFICE document ID')
  const safeRevision = Math.max(1, Number.parseInt(revision, 10) || 1)
  const baseUrl = String(appInternalUrl).replace(/\/$/, '')
  const config = {
    document: {
      fileType: 'docx',
      key: `icat-${id}-r${safeRevision}`,
      title: sanitizeDocxFilename(filename),
      url: `${baseUrl}/api/onlyoffice/documents/${id}/source?revision=${safeRevision}`,
      permissions: {
        edit: true,
        download: true,
        print: true,
        review: true,
      },
    },
    documentType: 'word',
    editorConfig: {
      callbackUrl: `${baseUrl}/api/onlyoffice/documents/${id}/callback`,
      lang: 'ru',
      mode: 'edit',
      user: {
        id: 'icat-local-user',
        name: 'Локальный пользователь',
      },
      customization: {
        autosave: true,
        forcesave: true,
      },
    },
    height: '100%',
    type: 'desktop',
    width: '100%',
  }

  return { ...config, token: signJwt(config, jwtSecret) }
}

function rewriteDownloadUrl(value, reachableBaseUrl) {
  const source = new URL(value)
  const target = new URL(reachableBaseUrl)
  source.protocol = target.protocol
  source.username = target.username
  source.password = target.password
  source.host = target.host
  return source.toString()
}

module.exports = {
  buildOnlyOfficeConfig,
  isDocxBuffer,
  isValidDocumentId,
  rewriteDownloadUrl,
  sanitizeDocxFilename,
  signJwt,
}
