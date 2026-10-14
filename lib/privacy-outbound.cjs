const { AsyncLocalStorage } = require('node:async_hooks')
const crypto = require('node:crypto')

const storage = new AsyncLocalStorage()
let requiredByServer = false
const referenceKeys = new Set(['id', 'objectId', 'segmentId', 'tableId'])
const textKeys = /text|translation|instruction|message|title|notes|language|summary|prompt|name|^source$/i
const protocolValues = {
  type: new Set(['text', 'table', 'table_cell', 'stamp', 'seal', 'signature', 'handwriting', 'logo', 'image', 'unknown']),
  role: new Set(['user', 'assistant', 'system']),
  fontStyle: new Set(['normal', 'italic', 'oblique']),
  fontWeight: new Set(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']),
  textAlign: new Set(['left', 'right', 'center', 'justify']),
}
function checkStructured(value, field = '') {
  if (Array.isArray(value)) return value.forEach(child => checkStructured(child, field))
  if (value && typeof value === 'object') return Object.entries(value).forEach(([key, child]) => checkStructured(child, key))
  if (typeof value !== 'string' || !value.trim() || referenceKeys.has(field)) return
  if (protocolValues[field]?.has(value)) return
  if (!textKeys.test(field)) throw new Error('Непроверенное текстовое поле AI-запроса заблокировано.')
  assertPrivateText(value)
}

function enablePrivacyBoundary() { requiredByServer = true }
function withPrivacyScope(scope, callback) { return storage.run(scope, callback) }
function currentPrivacyScope() { return storage.getStore() }
function collectPrivateTexts(value, field = '', result = new Set()) {
  if (Array.isArray(value)) value.forEach(child => collectPrivateTexts(child, field, result))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => collectPrivateTexts(child, key, result))
  else if (typeof value === 'string' && textKeys.test(field) && value.trim()) result.add(value)
  return result
}
function trustPrivacyPrompt(value) {
  const scope = currentPrivacyScope()
  if (scope?.required) {
    scope.trustedPrompts ||= new Set()
    scope.trustedPrompts.add(value)
  }
  return value
}
function assertPrivateText(value) {
  const scope = currentPrivacyScope()
  if (!scope?.required || !value?.trim()) return
  if (![...(scope.approvedTexts || [])].some(text => text.includes(value))) throw new Error('В AI-запрос добавлен непроверенный текст. Отправка заблокирована.')
}

function references(value, mapping, reverse = false, key = '') {
  if (Array.isArray(value)) return value.map(item => references(item, mapping, reverse, key))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, references(item, mapping, reverse, name)]))
  if (typeof value === 'string' && referenceKeys.has(key)) {
    if (reverse) return mapping.get(value) || value
    if (!mapping.has(value)) mapping.set(value, `REF_${crypto.randomBytes(6).toString('hex')}`)
    return mapping.get(value)
  }
  return value
}

function decodeResult(payload, mapping) {
  const inverse = new Map([...mapping].map(([key, value]) => [value, key]))
  const result = references(payload, inverse, true)
  for (const choice of result?.choices || []) {
    const message = choice?.message
    if (typeof message?.content !== 'string') continue
    try {
      message.content = JSON.stringify(references(JSON.parse(message.content), inverse, true))
    } catch { /* Adapters reject malformed/non-JSON replies without applying them. */ }
  }
  return result
}

async function guardProviderRequest(url, options = {}) {
  const scope = currentPrivacyScope()
  const required = scope?.required ?? requiredByServer
  const method = String(options.method || 'GET').toUpperCase()
  if (!required || ['GET', 'HEAD'].includes(method)) return { options, decode: value => value }
  if (!scope?.outboundApproved) throw Object.assign(new Error('Отправка данных в ИИ заблокирована: сначала проверьте обезличенную копию документа.'), { code: 'PRIVACY_REQUIRED' })
  if (scope.assertCurrent) await scope.assertCurrent()
  if (new URL(url).pathname.endsWith('/embeddings')) throw new Error('Облачные embeddings отключены в защищённом режиме.')
  if (scope.provider !== 'aitunnel') throw new Error('Для защищённой обработки выберите AITunnel; облачный Codex с файловыми инструментами недоступен.')
  let body
  try { body = JSON.parse(options.body) } catch { throw new Error('Не удалось проверить содержимое защищённого AI-запроса.') }
  if (!Array.isArray(body.messages) || body.tools?.length || body.functions?.length) throw new Error('Запрос с файловыми инструментами или непроверенным протоколом заблокирован.')
  const mapping = new Map()
  for (const message of body.messages || []) {
    const contents = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }]
    for (const content of contents) {
      if (content.type === 'image_url') {
        const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(content.image_url?.url || '')
        if (!match || !scope.imageHashes?.has(crypto.createHash('sha256').update(Buffer.from(match[1], 'base64')).digest('hex'))) {
          throw new Error('Отправка изображения заблокирована: страница не входит в проверенную обезличенную копию.')
        }
      } else if (content.type === 'text' && typeof content.text === 'string') {
        let structured
        try { structured = JSON.parse(content.text) } catch { structured = null }
        if (structured) {
          checkStructured(structured)
          content.text = JSON.stringify(references(structured, mapping))
        } else if (!scope.trustedPrompts?.has(content.text)) throw new Error('Непроверенный промпт заблокирован.')
      } else throw new Error('Непроверенный тип содержимого AI-запроса заблокирован.')
    }
    if (Array.isArray(message.content)) message.content = contents
    else message.content = contents[0].text
  }
  return { options: { ...options, body: JSON.stringify(body) }, decode: value => {
    const decoded = decodeResult(value, mapping)
    scope.approvedTexts ||= new Set()
    for (const text of collectPrivateTexts(decoded)) scope.approvedTexts.add(text)
    for (const choice of decoded?.choices || []) {
      try { for (const text of collectPrivateTexts(JSON.parse(choice.message?.content))) scope.approvedTexts.add(text) } catch {}
    }
    return decoded
  } }
}

module.exports = { assertPrivateText, collectPrivateTexts, currentPrivacyScope, enablePrivacyBoundary,
  guardProviderRequest, references, trustPrivacyPrompt, withPrivacyScope }
