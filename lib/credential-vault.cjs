const crypto = require('node:crypto')

const SECRET_LIMIT_BYTES = 180

function createCredentialVault(options = {}) {
  const environmentSecret = String(options.environmentSecret || '').trim()
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
  })
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' })
  let sessionSecret = ''
  let updatedAt = null

  function decrypt(ciphertext) {
    if (typeof ciphertext !== 'string' || !/^[a-z0-9+/=]+$/i.test(ciphertext)) {
      throw new Error('Некорректный формат зашифрованного ключа')
    }
    let encrypted
    try {
      encrypted = Buffer.from(ciphertext, 'base64')
    } catch {
      throw new Error('Некорректный формат зашифрованного ключа')
    }
    if (!encrypted.length || encrypted.length > 512) throw new Error('Некорректный размер зашифрованного ключа')
    let decrypted
    try {
      decrypted = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      }, encrypted)
    } catch {
      throw new Error('Не удалось расшифровать ключ. Обновите страницу и повторите ввод')
    }
    const secret = decrypted.toString('utf8').trim()
    if (Buffer.byteLength(secret) < 8 || Buffer.byteLength(secret) > SECRET_LIMIT_BYTES) {
      throw new Error('Ключ должен содержать от 8 до 180 байт')
    }
    return secret
  }

  return {
    algorithm: 'RSA-OAEP-256',
    publicKeyPem,
    setEncrypted(ciphertext) {
      sessionSecret = decrypt(ciphertext)
      updatedAt = new Date().toISOString()
    },
    clearSession() {
      sessionSecret = ''
      updatedAt = null
    },
    getSecret() {
      return sessionSecret || environmentSecret
    },
    status() {
      return {
        configured: Boolean(sessionSecret || environmentSecret),
        source: sessionSecret ? 'session' : environmentSecret ? 'environment' : null,
        updatedAt,
      }
    },
  }
}

module.exports = { SECRET_LIMIT_BYTES, createCredentialVault }
