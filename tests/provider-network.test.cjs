const test = require('node:test')
const assert = require('node:assert/strict')
const { createDnsLookup, createProviderTransport, networkError } = require('../lib/provider-network.cjs')

function lookup(resolver, hostname, options) {
  return new Promise((resolve, reject) => createDnsLookup(resolver)(hostname, options, (error, address, family) => {
    if (error) reject(error)
    else resolve({ address, family })
  }))
}

test('custom DNS supports lookup callback contracts, IPv4 preference and IPv6-only endpoints', async () => {
  const resolver = { resolve4: async () => ['192.0.2.1', '192.0.2.2'], resolve6: async () => ['2001:db8::1'] }
  assert.deepEqual(await lookup(resolver, 'provider.test', {}), { address: '192.0.2.1', family: 4 })
  assert.deepEqual((await lookup(resolver, 'provider.test', { all: true })).address, [
    { address: '192.0.2.1', family: 4 }, { address: '192.0.2.2', family: 4 },
  ])
  assert.deepEqual(await lookup(resolver, 'provider.test', { family: 6 }), { address: '2001:db8::1', family: 6 })
  const ipv6Only = { ...resolver, resolve4: async () => { throw Object.assign(new Error('No A record'), { code: 'ENODATA' }) } }
  assert.equal((await lookup(ipv6Only, 'provider.test', {})).family, 6)
  await assert.rejects(lookup(ipv6Only, 'provider.test', { family: 4 }), { code: 'ENODATA' })
  assert.equal((await lookup({}, '192.0.2.1', {})).address, '192.0.2.1')
})

test('custom DNS timeout fails without falling back to another resolver or resending requests', async () => {
  let ipv6Calls = 0
  await assert.rejects(lookup({
    resolve4: async () => { throw Object.assign(new Error('DNS timeout'), { code: 'ETIMEOUT' }) },
    resolve6: async () => { ipv6Calls++; return ['2001:db8::1'] },
  }, 'provider.test', {}), { code: 'ETIMEOUT' })
  assert.equal(ipv6Calls, 0)
})

test('provider transport preserves HTTPS URL, authorization and cancellation while using a scoped dispatcher', async () => {
  const controller = new AbortController()
  const options = { method: 'POST', body: 'private-document-data', headers: { Authorization: 'Bearer secret' }, signal: controller.signal }
  const url = 'https://provider.test/v1/chat/completions'
  let calls = 0
  const transport = createProviderTransport({ servers: '1.1.1.1', fetchImpl: async (actualUrl, actualOptions) => {
    calls++
    assert.equal(actualUrl, url)
    assert.equal(actualOptions.body, options.body)
    assert.equal(actualOptions.headers, options.headers)
    assert.equal(actualOptions.signal, controller.signal)
    assert.ok(actualOptions.dispatcher)
    throw new TypeError('fetch failed', { cause: Object.assign(new Error('secret private-document-data'), { code: 'UND_ERR_CONNECT_TIMEOUT' }) })
  } })
  try {
    await assert.rejects(transport.fetch(url, options), error => {
      assert.match(error.message, /время подключения/)
      assert.doesNotMatch(error.message, /secret|private-document-data/)
      assert.equal(error.code, 'AI_NETWORK_ERROR')
      return true
    })
    assert.equal(calls, 1)
  } finally { await transport.close() }
})

test('default transport keeps system DNS; DNS configuration and readable errors are validated', async () => {
  const transport = createProviderTransport({ fetchImpl: async (url, options) => {
    assert.equal(options.dispatcher, undefined)
    return { ok: true }
  } })
  assert.equal((await transport.fetch('https://provider.test')).ok, true)
  assert.throws(() => createProviderTransport({ servers: 'not-a-dns-server' }), /IP-адреса/)
  const dns = new TypeError('fetch failed', { cause: Object.assign(new Error('private'), { code: 'ENOTFOUND' }) })
  assert.match(networkError(dns).message, /DNS/)
  const certificate = new TypeError('fetch failed', { cause: Object.assign(new Error('private'), { code: 'CERT_HAS_EXPIRED' }) })
  assert.match(networkError(certificate).message, /сертификат/)
  const cancelled = new DOMException('Cancelled', 'AbortError')
  assert.equal(networkError(cancelled), cancelled)
  const parsing = new SyntaxError('Invalid JSON')
  assert.equal(networkError(parsing), parsing)
})
