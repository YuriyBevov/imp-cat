const { Resolver } = require('node:dns/promises')
const { isIP } = require('node:net')
const { Agent } = require('undici')

function createDnsLookup(resolver) {
  return (hostname, options, callback) => {
    const family = typeof options === 'number' ? options : Number(options?.family) || 0
    const all = Boolean(options?.all)
    const deliver = rows => all ? callback(null, rows) : callback(null, rows[0].address, rows[0].family)
    const literalFamily = isIP(hostname)
    if (literalFamily) return queueMicrotask(() => deliver([{ address: hostname, family: literalFamily }]))
    const resolve = async () => {
      let addresses
      if (family === 6) return (await resolver.resolve6(hostname)).map(address => ({ address, family: 6 }))
      try {
        addresses = await resolver.resolve4(hostname)
        if (addresses.length) return addresses.map(address => ({ address, family: 4 }))
      } catch (error) {
        if (family === 4 || !['ENODATA', 'ENOTFOUND'].includes(error.code)) throw error
      }
      if (family === 4) throw Object.assign(new Error('No DNS address'), { code: 'ENOTFOUND' })
      return (await resolver.resolve6(hostname)).map(address => ({ address, family: 6 }))
    }
    resolve().then(rows => {
      if (!rows.length) return callback(Object.assign(new Error('No DNS address'), { code: 'ENOTFOUND' }))
      deliver(rows)
    }, callback)
  }
}

function networkError(error, signal) {
  if (signal?.aborted && signal.reason?.name !== 'TimeoutError') return error
  if (error?.name === 'AbortError') return error
  const codes = new Set()
  const visit = (value, depth = 0) => {
    if (!value || depth > 4) return
    if (typeof value.code === 'string') codes.add(value.code)
    visit(value.cause, depth + 1)
    for (const child of value.errors || []) visit(child, depth + 1)
  }
  visit(error)
  let detail
  if (['ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ETIMEOUT'].some(code => codes.has(code))) {
    detail = 'DNS не смог определить адрес AI-провайдера. Проверьте DNS и интернет; для серверных AI-запросов можно настроить AI_DNS_SERVERS.'
  } else if (codes.has('UND_ERR_CONNECT_TIMEOUT') || codes.has('ETIMEDOUT')) {
    detail = 'Истекло время подключения к AI-провайдеру. Проверьте интернет, DNS, VPN или прокси.'
  } else if (error?.name === 'TimeoutError') {
    detail = 'Истекло время ожидания ответа AI-провайдера. Проверьте соединение и повторите обработку.'
  } else if ([...codes].some(code => /CERT|TLS|SSL/.test(code))) {
    detail = 'Не удалось проверить HTTPS-сертификат AI-провайдера. Проверьте дату компьютера и настройки сети.'
  } else if (['ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_SOCKET'].some(code => codes.has(code))) {
    detail = 'Соединение с AI-провайдером прервано или недоступно. Проверьте интернет, VPN или прокси и повторите обработку.'
  } else if (error?.message === 'fetch failed') {
    detail = 'Не удалось установить соединение с AI-провайдером. Проверьте интернет, DNS, VPN или прокси.'
  } else return error
  // Never include request URL, headers, provider messages or document data.
  return Object.assign(new Error(detail, { cause: error }), { code: 'AI_NETWORK_ERROR' })
}

function createProviderTransport(options = {}) {
  const servers = String(options.servers || '').split(',').map(value => value.trim()).filter(Boolean)
  let dispatcher = null
  if (servers.length) {
    const resolver = new Resolver({ timeout: 3_000, tries: 1 })
    try { resolver.setServers(servers) } catch {
      throw new Error('AI_DNS_SERVERS должен содержать IP-адреса DNS-серверов через запятую.')
    }
    dispatcher = new Agent({
      connect: { lookup: createDnsLookup(resolver), timeout: 15_000 },
      // Existing AbortSignals bound long AI requests, including response bodies.
      headersTimeout: 0,
      bodyTimeout: 0,
    })
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch
  return {
    async fetch(url, requestOptions = {}) {
      try {
        return await fetchImpl(url, dispatcher ? { ...requestOptions, dispatcher } : requestOptions)
      } catch (error) {
        throw networkError(error, requestOptions.signal)
      }
    },
    async close() { if (dispatcher) await dispatcher.close() },
  }
}

let defaultTransport
function providerFetch(url, options) {
  defaultTransport ||= createProviderTransport({ servers: process.env.AI_DNS_SERVERS })
  return defaultTransport.fetch(url, options)
}

module.exports = { createDnsLookup, createProviderTransport, networkError, providerFetch }
