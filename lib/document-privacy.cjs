const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const ID = /^[a-f0-9]{32}$/
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const contextDigest = value => hash(JSON.stringify(value))

function createDocumentPrivacy(options) {
  const { rootDir, dataDir, runProcess } = options
  const pythonBin = options.pythonBin || path.join(rootDir, '.venv', 'bin', 'python')
  const key = options.keyPath || process.env.DOCUMENT_PRIVACY_KEY_FILE || path.join(os.homedir(), '.local', 'share', 'icat', 'privacy.key')
  const script = path.join(rootDir, 'scripts', 'privacy_service.py')
  const queues = new Map()
  let initialized
  function directory(id) {
    if (!ID.test(String(id))) throw new Error('Некорректный ID документа.')
    return path.join(dataDir, id)
  }
  function generationDirectory(id, generation) {
    if (!ID.test(String(generation))) throw new Error('Некорректная версия обезличивания.')
    return path.join(directory(id), 'privacy', generation)
  }
  async function write(target, value) {
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    const temporary = `${target}.${crypto.randomUUID()}.writing`
    try {
      await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' })
      await fs.rename(temporary, target)
    } finally { await fs.rm(temporary, { force: true }) }
  }
  async function invoke(operation, { id, generation, payload, input, output, signal } = {}) {
    if (operation !== 'init') {
      initialized ||= invoke('init').catch(error => { initialized = null; throw error })
      await initialized
    }
    const temporaryDirectory = id ? path.join(directory(id), 'privacy') : path.join(rootDir, '.build', 'privacy-service')
    await fs.mkdir(temporaryDirectory, { recursive: true, mode: 0o700 })
    const requestFile = path.join(temporaryDirectory, `.request-${crypto.randomUUID()}.json`)
    const responseFile = path.join(temporaryDirectory, `.response-${crypto.randomUUID()}.json`)
    const args = [script, operation, '--key', key]
    if (generation) args.push('--directory', generationDirectory(id, generation))
    if (payload !== undefined) {
      await fs.writeFile(requestFile, JSON.stringify(payload), { mode: 0o600, flag: 'wx' })
      args.push('--input', requestFile)
    } else if (input) args.push('--input', input)
    args.push('--output', output || responseFile)
    try {
      const result = await runProcess(pythonBin, args, 900_000, { signal })
      if (result.code !== 0) {
        const error = new Error('Локальная проверка обезличивания не завершена. Проверьте зависимости, OCR, язык и размеры масок; отправка в ИИ заблокирована.')
        error.code = 'PRIVACY_LOCAL_ERROR'
        // Only the local Python service's explicitly sanitized public errors are exposed.
        const detail = String(result.stderr || '').trim()
        if (detail && !detail.includes('Traceback') && detail.length < 700) error.message += ` ${detail}`
        throw error
      }
      if (operation === 'settings') return { ok: true }
      return JSON.parse(await fs.readFile(output || responseFile, 'utf8'))
    } finally { await Promise.all([requestFile, responseFile].map(file => fs.rm(file, { force: true }))) }
  }
  async function serial(id, action) {
    const previous = queues.get(id) || Promise.resolve()
    const current = previous.catch(() => {}).then(action)
    queues.set(id, current)
    try { return await current } finally { if (queues.get(id) === current) queues.delete(id) }
  }
  async function state(id) {
    try { return JSON.parse(await fs.readFile(path.join(directory(id), 'privacy-state.json'), 'utf8')) }
    catch (error) { if (error.code === 'ENOENT') return { phase: 'missing' }; throw error }
  }
  async function stage(id, settings) {
    return serial(id, async () => {
      const previous = await state(id)
      await fs.chmod(directory(id), 0o700)
      if (previous.phase === 'preparing') throw new Error('Обезличивание этого документа уже выполняется.')
      const generation = crypto.randomBytes(16).toString('hex')
      const file = path.join(directory(id), 'privacy', `${generation}.settings.enc`)
      const previousApproved = previous.phase === 'approved' ? previous.generation : previous.previousApproved
      await invoke('settings', { id, payload: { ...settings,
        previousDirectory: previousApproved ? generationDirectory(id, previousApproved) : null }, output: file })
      await write(path.join(directory(id), 'privacy-state.json'), {
        phase: 'preparing', generation, previousApproved, language: settings.language,
        rotations: settings.rotations, createdAt: new Date().toISOString(),
      })
      return { generation }
    })
  }
  async function runPreparation(id, generation, signal) {
    return serial(id, async () => {
      const current = await state(id)
      if (current.generation !== generation || current.phase !== 'preparing') throw new Error('Настройки обезличивания изменились.')
      try {
        const result = await invoke('prepare', { id, generation,
          input: path.join(directory(id), 'privacy', `${generation}.settings.enc`), signal })
        await write(path.join(directory(id), 'privacy-state.json'), { ...current, phase: 'review' })
        return result
      } catch (error) {
        await write(path.join(directory(id), 'privacy-state.json'), { ...current, phase: 'failed' })
        throw error
      }
    })
  }
  async function recordJob(id, generation, jobId) {
    return serial(id, async () => {
      const current = await state(id)
      if (current.generation !== generation) throw new Error('Версия обезличивания изменилась.')
      await write(path.join(directory(id), 'privacy-state.json'), { ...current, jobId })
    })
  }
  async function markCancelled(id, jobId) {
    return serial(id, async () => {
      const current = await state(id)
      if (current.jobId === jobId && current.phase === 'preparing') await write(path.join(directory(id), 'privacy-state.json'), { ...current, phase: 'failed' })
    })
  }
  async function review(id) {
    const current = await state(id)
    if (!['review', 'approved'].includes(current.phase)) return { ...current, documentId: id }
    const value = await invoke('review', { id, generation: current.generation })
    const settings = await invoke('open', { id, input: path.join(directory(id), 'privacy', `${current.generation}.settings.enc`) })
    return { ...value, ...current, settings: { language: settings.language, knownValues: settings.knownValues,
      allowValues: settings.allowValues, regions: settings.regions }, documentId: id, pages: value.pages.map(page => ({ ...page,
      unreadable: value.unreadablePages?.includes(page.index),
      imageUrl: `/api/studio/documents/${id}/privacy/pages/${page.index}/image?generation=${current.generation}`,
      originalImageUrl: `/api/studio/documents/${id}/preparation/pages/${page.index}/image`,
    })) }
  }
  async function approvePages(id, request) {
    return serial(id, async () => {
      const current = await state(id)
      if (!['review', 'approved'].includes(current.phase) || request.generation !== current.generation) throw new Error('Подготовьте и проверьте актуальную копию документа.')
      await invoke(current.phase === 'approved' ? 'replacements' : 'approve', { id, generation: current.generation, payload: request })
      await write(path.join(directory(id), 'privacy-state.json'), { ...current, phase: 'approved', approvedAt: new Date().toISOString() })
      return { ok: true }
    })
  }
  async function approved(id, rotations) {
    const current = await state(id)
    if (current.phase !== 'approved') throw Object.assign(new Error('Сначала подготовьте и подтвердите обезличенную копию документа.'), { status: 409, code: 'PRIVACY_PREPARATION_REQUIRED' })
    if (rotations && JSON.stringify(rotations) !== JSON.stringify(current.rotations)) throw Object.assign(new Error('Поворот страниц изменился. Подготовьте и проверьте новую обезличенную копию.'), { status: 409, code: 'PRIVACY_PREPARATION_REQUIRED' })
    const result = await invoke('verify', { id, generation: current.generation })
    const files = await fs.readdir(directory(id))
    const source = files.find(name => /^source\.(pdf|png|jpe?g|webp|tiff?|heic|bmp)$/i.test(name))
    if (!source || hash(await fs.readFile(path.join(directory(id), source))) !== result.sourceHash) throw new Error('Исходник изменился после проверки. Отправка в ИИ заблокирована.')
    const pagesDirectory = generationDirectory(id, current.generation)
    const imageHashes = new Set(result.review.pages.map(page => result.artifactHashes[page.image]))
    return { ...current, directory: pagesDirectory, pagesDirectory, imageHashes,
      pageTokens: result.review.pages.map(page => [...new Set(page.masks.map(mask => mask.token))]),
      manifest: { engine: 'Local privacy renderer', pages: result.review.pages.map((page, index) => ({
        index, width: page.width, height: page.height, image: page.image, rotation: current.rotations[index],
      })) } }
  }
  async function sanitizeContext(id, context, knownValues = []) {
    return serial(id, async () => {
      const current = await state(id)
      return invoke('sanitize', { id, generation: current.generation, payload: { context, knownValues } })
    })
  }
  async function sealContext(id, context) {
    return serial(id, async () => {
      const current = await state(id)
      return invoke('seal', { id, generation: current.generation, payload: context })
    })
  }
  async function restoreScene(id, scene) {
    if (!JSON.stringify(scene).includes('ICATPII_')) return scene
    const current = await state(id)
    if (current.phase === 'missing') return scene
    const generation = current.phase === 'approved' ? current.generation : current.previousApproved
    if (!generation) throw new Error('Нельзя восстановить значения до подтверждения обезличивания.')
    return serial(id, () => invoke('restore', { id, generation, payload: scene }))
  }
  async function saveChallenge(id, challenge) {
    const token = crypto.randomBytes(16).toString('hex')
    const file = path.join(directory(id), 'privacy', `challenge-${token}.enc`)
    const current = await state(id)
    await invoke('settings', { id, payload: { ...challenge, generation: current.generation, createdAt: Date.now() }, output: file })
    return token
  }
  async function readChallenge(id, token) {
    if (!ID.test(String(token))) throw new Error('Некорректное подтверждение отправки.')
    const value = await invoke('open', { id, input: path.join(directory(id), 'privacy', `challenge-${token}.enc`) })
    const current = await state(id)
    if (value.generation !== current.generation || Date.now() - value.createdAt > 30 * 60_000) throw new Error('Подтверждение устарело. Проверьте отправляемые данные снова.')
    return value
  }
  async function updateChallenge(id, token, knownValues, reviewed, digest) {
    return serial(id, async () => {
      const value = await readChallenge(id, token)
      if (reviewed && digest !== contextDigest(value.context)) throw new Error('Содержимое изменилось. Сначала просмотрите актуальные данные.')
      const current = await state(id)
      const sanitized = knownValues?.length
        ? await invoke('sanitize', { id, generation: current.generation, payload: { context: value.rawContext, knownValues } })
        : { context: value.context, unreviewed: value.unreviewed }
      const next = { ...value, context: sanitized.context, unreviewed: sanitized.unreviewed, approved: Boolean(reviewed && !knownValues?.length) }
      await invoke('settings', { id, payload: next, output: path.join(directory(id), 'privacy', `challenge-${token}.enc`) })
      return { token, digest: contextDigest(next.context), approved: next.approved, texts: next.unreviewed, context: next.context }
    })
  }
  async function freezeContext(id, context) {
    const token = crypto.randomBytes(16).toString('hex')
    const current = await state(id)
    await invoke('settings', { id, payload: { generation: current.generation, context },
      output: path.join(directory(id), 'privacy', `snapshot-${token}.enc`) })
    return token
  }
  async function frozenContext(id, token) {
    if (!ID.test(String(token))) throw new Error('Некорректная защищённая копия задания.')
    const value = await invoke('open', { id, input: path.join(directory(id), 'privacy', `snapshot-${token}.enc`) })
    const current = await state(id)
    if (value.generation !== current.generation) throw new Error('Обезличенная копия изменилась после постановки задания в очередь.')
    return value.context
  }
  return { approved, approvePages, contextDigest, generationDirectory, invoke, readChallenge, restoreScene,
    review, runPreparation, sanitizeContext, saveChallenge, sealContext, stage, state, updateChallenge,
    freezeContext, frozenContext, recordJob, markCancelled }
}

module.exports = { contextDigest, createDocumentPrivacy }
