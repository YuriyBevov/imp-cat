const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const MANAGED_KEYS = new Set([
  'AI_PROVIDER',
  'TRANSLATION_API_URL',
  'TRANSLATION_API_KEY',
  'TRANSLATION_MODEL',
  'AI_API_KEY',
])

function encodeEnvValue(value) {
  const text = String(value ?? '')
  if (/[\u0000\r\n]/.test(text)) throw new Error('Значение настройки содержит недопустимые символы')
  return JSON.stringify(text)
}

async function readSafeEnvFile(envPath) {
  try {
    const stat = await fs.promises.lstat(envPath)
    if (stat.isSymbolicLink()) throw new Error('Файл .env не должен быть символической ссылкой')
    if (!stat.isFile()) throw new Error('Путь .env не является файлом')
    if (stat.size > 1024 * 1024) throw new Error('Файл .env слишком большой')
    return await fs.promises.readFile(envPath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

async function updateEnvCredentials(envPath, updates) {
  const resolvedPath = path.resolve(envPath)
  const source = await readSafeEnvFile(resolvedPath)
  const requested = new Map()
  for (const [key, value] of Object.entries(updates || {})) {
    if (!MANAGED_KEYS.has(key)) throw new Error(`Нельзя изменять параметр ${key} через хранилище ключей`)
    requested.set(key, value == null ? null : encodeEnvValue(value))
  }

  const output = []
  const handled = new Set()
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    const key = match?.[1]
    if (!key || !requested.has(key)) {
      output.push(line)
      continue
    }
    if (handled.has(key)) continue
    handled.add(key)
    const encoded = requested.get(key)
    if (encoded != null) output.push(`${key}=${encoded}`)
  }
  for (const [key, encoded] of requested) {
    if (!handled.has(key) && encoded != null) output.push(`${key}=${encoded}`)
  }
  while (output.length && output.at(-1) === '') output.pop()
  const content = `${output.join('\n')}\n`
  await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true })
  const temporaryPath = path.join(
    path.dirname(resolvedPath),
    `.${path.basename(resolvedPath)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.writing`,
  )
  try {
    await fs.promises.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    await fs.promises.rename(temporaryPath, resolvedPath)
    await fs.promises.chmod(resolvedPath, 0o600)
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true })
    throw error
  }
}

module.exports = { MANAGED_KEYS, encodeEnvValue, updateEnvCredentials }
