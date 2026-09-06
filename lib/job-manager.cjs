const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

function cleanDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = {}
  for (const [key, raw] of Object.entries(value).slice(0, 20)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) continue
    if (typeof raw === 'number' && Number.isFinite(raw)) result[key] = raw
    else if (typeof raw === 'string') result[key] = raw.slice(0, 240)
    else if (typeof raw === 'boolean') result[key] = raw
  }
  return Object.keys(result).length ? result : null
}

function cloneJob(job) {
  return {
    id: job.id,
    kind: job.kind,
    title: job.title,
    provider: job.provider || null,
    model: job.model || null,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    details: job.details || null,
    events: Array.isArray(job.events) ? job.events.slice(-20).map(event => ({ ...event })) : [],
    resumable: Boolean(job.resumable),
    recovered: Boolean(job.recovered),
    documentId: job.documentId || null,
    error: job.error || null,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
    updatedAt: job.updatedAt,
  }
}

function persistedJob(job) {
  return {
    ...cloneJob(job),
    payload: job.resumable && job.payload && typeof job.payload === 'object' ? job.payload : null,
  }
}

function createJobManager(options = {}) {
  const concurrency = Math.max(1, Math.min(8, Number(options.concurrency) || 2))
  const retained = Math.max(10, Math.min(1_000, Number(options.retained) || 100))
  const storagePath = options.storagePath ? path.resolve(options.storagePath) : null
  const jobs = new Map()
  const queue = []
  const handlers = new Map()
  let running = 0

  function persist() {
    if (!storagePath) return
    fs.mkdirSync(path.dirname(storagePath), { recursive: true })
    const temporary = `${storagePath}.${process.pid}.writing`
    const data = {
      version: 1,
      updatedAt: new Date().toISOString(),
      jobs: [...jobs.values()].map(persistedJob),
    }
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(temporary, storagePath)
  }

  function addEvent(job) {
    job.events = Array.isArray(job.events) ? job.events : []
    const previous = job.events[job.events.length - 1]
    const event = {
      at: job.updatedAt,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      details: job.details || null,
    }
    if (previous && previous.stage === event.stage && previous.progress === event.progress && previous.message === event.message) return
    job.events.push(event)
    if (job.events.length > 50) job.events.splice(0, job.events.length - 50)
  }

  function restore() {
    if (!storagePath) return
    let parsed
    try { parsed = JSON.parse(fs.readFileSync(storagePath, 'utf8')) }
    catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return
      throw error
    }
    for (const value of Array.isArray(parsed?.jobs) ? parsed.jobs : []) {
      if (!/^[a-f0-9]{32}$/.test(String(value?.id || ''))) continue
      const now = new Date().toISOString()
      const wasPending = value.status === 'queued' || value.status === 'running'
      const resumable = Boolean(value.resumable && value.payload && typeof value.payload === 'object')
      const job = {
        id: String(value.id),
        kind: String(value.kind || 'generic').slice(0, 80),
        title: String(value.title || 'Задание').slice(0, 240),
        provider: value.provider ? String(value.provider).slice(0, 40) : null,
        model: value.model ? String(value.model).slice(0, 160) : null,
        documentId: value.documentId ? String(value.documentId).slice(0, 80) : null,
        payload: resumable ? value.payload : null,
        task: null,
        controller: null,
        resumable,
        recovered: wasPending && resumable,
        status: wasPending ? (resumable ? 'queued' : 'failed') : TERMINAL_STATUSES.has(value.status) ? value.status : 'failed',
        stage: wasPending ? (resumable ? 'resuming' : 'failed') : String(value.stage || value.status || 'failed').slice(0, 80),
        progress: wasPending && resumable ? Math.max(0, Math.min(99, Number(value.progress) || 0)) : Math.max(0, Math.min(100, Number(value.progress) || 0)),
        message: wasPending
          ? resumable ? 'Восстановлено после перезапуска сервера; ожидает продолжения' : 'Задание нельзя восстановить после перезапуска'
          : String(value.message || '').slice(0, 500),
        details: cleanDetails(value.details),
        events: Array.isArray(value.events) ? value.events.slice(-50) : [],
        error: wasPending && !resumable ? 'Задание было прервано перезапуском сервера' : value.error ? String(value.error).slice(0, 2_000) : null,
        createdAt: String(value.createdAt || now).slice(0, 80),
        startedAt: wasPending && resumable ? null : value.startedAt ? String(value.startedAt).slice(0, 80) : null,
        completedAt: wasPending && !resumable ? now : value.completedAt ? String(value.completedAt).slice(0, 80) : null,
        updatedAt: now,
      }
      jobs.set(job.id, job)
      if (job.status === 'queued') queue.push(job)
    }
    persist()
  }

  function trim() {
    const completed = [...jobs.values()]
      .filter(job => TERMINAL_STATUSES.has(job.status))
      .sort((left, right) => String(left.completedAt).localeCompare(String(right.completedAt)))
    while (jobs.size > retained && completed.length) jobs.delete(completed.shift().id)
  }

  function update(job, patch) {
    if (!job || TERMINAL_STATUSES.has(job.status)) return
    if (patch.stage != null) job.stage = String(patch.stage).slice(0, 80)
    if (patch.message != null) job.message = String(patch.message).slice(0, 500)
    if (patch.documentId != null) job.documentId = String(patch.documentId).slice(0, 80)
    if (patch.details !== undefined) job.details = cleanDetails(patch.details)
    if (patch.progress != null) {
      const progress = Number(patch.progress)
      if (Number.isFinite(progress)) job.progress = Math.max(job.progress, Math.min(99, Math.max(0, Math.round(progress))))
    }
    job.updatedAt = new Date().toISOString()
    addEvent(job)
    persist()
  }

  function runnableTask(job) {
    if (typeof job.task === 'function') return (updateProgress, context) => job.task(updateProgress, context)
    const handler = handlers.get(job.kind)
    return handler ? (updateProgress, context) => handler(job.payload, updateProgress, context) : null
  }

  function pump() {
    while (running < concurrency && queue.length) {
      const index = queue.findIndex(job => runnableTask(job))
      if (index < 0) return
      const [job] = queue.splice(index, 1)
      const task = runnableTask(job)
      running += 1
      job.controller = new AbortController()
      job.status = 'running'
      job.stage = job.recovered ? 'resuming' : 'starting'
      job.message = job.recovered ? 'Продолжаем задание после перезапуска сервера' : 'Запускаем обработку'
      job.startedAt = new Date().toISOString()
      job.updatedAt = job.startedAt
      addEvent(job)
      persist()
      Promise.resolve()
        .then(() => task(patch => update(job, patch), {
          signal: job.controller.signal,
          job: cloneJob(job),
          payload: job.payload,
        }))
        .then(result => {
          if (job.controller.signal.aborted) {
            job.status = 'cancelled'
            job.stage = 'cancelled'
            job.error = null
            job.message = 'Задание отменено пользователем'
            return
          }
          job.status = 'completed'
          job.stage = 'completed'
          job.progress = 100
          job.message = String(result?.message || 'Готово').slice(0, 500)
          job.details = cleanDetails(result?.details) || job.details
          if (result?.documentId) job.documentId = String(result.documentId)
        })
        .catch(error => {
          if (job.controller.signal.aborted || error?.name === 'AbortError') {
            job.status = 'cancelled'
            job.stage = 'cancelled'
            job.error = null
            job.message = 'Задание отменено пользователем'
            return
          }
          job.status = 'failed'
          job.stage = 'failed'
          job.error = String(error?.message || error || 'Неизвестная ошибка').slice(0, 2_000)
          job.message = 'Обработка завершилась с ошибкой'
        })
        .finally(() => {
          job.completedAt = new Date().toISOString()
          job.updatedAt = job.completedAt
          job.task = null
          job.controller = null
          job.recovered = false
          addEvent(job)
          running -= 1
          trim()
          persist()
          setImmediate(pump)
        })
    }
  }

  restore()

  return {
    register(kind, handler) {
      if (!kind || typeof handler !== 'function') throw new TypeError('Для типа задания необходим обработчик')
      handlers.set(String(kind), handler)
      setImmediate(pump)
    },
    enqueue({ kind = 'generic', title = 'Задание', documentId = null, provider = null, model = null, payload = null, task = null }) {
      const resumable = Boolean(payload && typeof payload === 'object' && !Array.isArray(payload))
      if (typeof task !== 'function' && !resumable) throw new TypeError('Для задания необходима функция task или сериализуемый payload')
      if (!task && !handlers.has(String(kind))) throw new TypeError(`Не зарегистрирован обработчик задания ${kind}`)
      const now = new Date().toISOString()
      const job = {
        id: crypto.randomBytes(16).toString('hex'),
        kind: String(kind).slice(0, 80),
        title: String(title).slice(0, 240),
        provider: provider ? String(provider).slice(0, 40) : null,
        model: model ? String(model).slice(0, 160) : null,
        documentId,
        payload: resumable ? structuredClone(payload) : null,
        task,
        controller: null,
        resumable,
        recovered: false,
        status: 'queued',
        stage: 'queued',
        progress: 0,
        message: 'Ожидает обработки',
        details: null,
        events: [],
        error: null,
        createdAt: now,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      }
      addEvent(job)
      jobs.set(job.id, job)
      queue.push(job)
      persist()
      setImmediate(pump)
      return cloneJob(job)
    },
    cancel(id) {
      const job = jobs.get(String(id))
      if (!job) return null
      if (TERMINAL_STATUSES.has(job.status)) return cloneJob(job)
      if (job.status === 'queued') {
        const index = queue.indexOf(job)
        if (index >= 0) queue.splice(index, 1)
        job.status = 'cancelled'
        job.stage = 'cancelled'
        job.message = 'Задание отменено пользователем'
        job.completedAt = new Date().toISOString()
        job.updatedAt = job.completedAt
        addEvent(job)
        persist()
      } else {
        job.message = 'Останавливаем запрос и дочерние процессы…'
        job.updatedAt = new Date().toISOString()
        addEvent(job)
        persist()
        job.controller?.abort(new DOMException('Задание отменено', 'AbortError'))
      }
      return cloneJob(job)
    },
    get(id) {
      const job = jobs.get(String(id))
      return job ? cloneJob(job) : null
    },
    list() {
      return [...jobs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(cloneJob)
    },
  }
}

module.exports = { TERMINAL_STATUSES, createJobManager }
