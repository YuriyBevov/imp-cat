const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const { encodeEnvValue, updateEnvCredentials } = require('../lib/env-credentials.cjs')

test('environment credential writer preserves unrelated settings and restricts file permissions', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-env-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  const envPath = path.join(directory, '.env')
  await fs.promises.writeFile(envPath, '# existing\nPORT=3100\nTRANSLATION_API_KEY="old"\n', { mode: 0o644 })
  await updateEnvCredentials(envPath, {
    AI_PROVIDER: 'aitunnel',
    TRANSLATION_API_KEY: 'test-secret-without-real-access',
    TRANSLATION_MODEL: 'vision-model',
  })
  const content = await fs.promises.readFile(envPath, 'utf8')
  const mode = (await fs.promises.stat(envPath)).mode & 0o777
  assert.match(content, /^# existing\nPORT=3100/m)
  assert.match(content, /AI_PROVIDER="aitunnel"/)
  assert.match(content, /TRANSLATION_MODEL="vision-model"/)
  assert.equal((content.match(/TRANSLATION_API_KEY=/g) || []).length, 1)
  assert.equal(mode, 0o600)
  const loaded = spawnSync(process.execPath, [
    `--env-file=${envPath}`,
    '-e',
    `process.exit(process.env.TRANSLATION_API_KEY === 'test-secret-without-real-access' ? 0 : 1)`,
  ], { encoding: 'utf8' })
  assert.equal(loaded.status, 0)
  assert.equal(loaded.stdout, '')
})

test('environment credential writer removes both supported secret names', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-env-remove-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  const envPath = path.join(directory, '.env')
  await fs.promises.writeFile(envPath, 'TRANSLATION_API_KEY="one"\nAI_API_KEY="two"\nPORT=3100\n')
  await updateEnvCredentials(envPath, { TRANSLATION_API_KEY: null, AI_API_KEY: null })
  const content = await fs.promises.readFile(envPath, 'utf8')
  assert.doesNotMatch(content, /API_KEY/)
  assert.match(content, /PORT=3100/)
})

test('environment credential writer rejects unsafe values and symbolic links', async t => {
  assert.throws(() => encodeEnvValue('secret\nINJECTED=value'), /недопустимые символы/i)
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-env-link-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  const target = path.join(directory, 'target')
  const envPath = path.join(directory, '.env')
  await fs.promises.writeFile(target, 'SAFE=1\n')
  await fs.promises.symlink(target, envPath)
  await assert.rejects(
    () => updateEnvCredentials(envPath, { TRANSLATION_API_KEY: 'test-secret' }),
    /символической ссылкой/i,
  )
  assert.equal(await fs.promises.readFile(target, 'utf8'), 'SAFE=1\n')
})
