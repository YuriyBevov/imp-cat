const crypto = require('node:crypto')

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
    documentId: job.documentId || null,
    error: job.error || null,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
    updatedAt: job.updatedAt,
  }
}

function createJobManager(options = {}) {
  const concurrency = Math.max(1, Math.min(8, Number(options.concurrency) || 2))
  const retained = Math.max(10, Math.min(1_000, Number(options.retained) || 100))
  const jobs = new Map()
  const queue = []
  let running = 0

  function trim() {
    const completed = [...jobs.values()]
      .filter(job => job.status === 'completed' || job.status === 'failed')
      .sort((left, right) => String(left.completedAt).localeCompare(String(right.completedAt)))
    while (jobs.size > retained && completed.length) jobs.delete(completed.shift().id)
  }

  function update(job, patch) {
    if (!job || job.status === 'completed' || job.status === 'failed') return
    if (patch.stage != null) job.stage = String(patch.stage).slice(0, 80)
    if (patch.message != null) job.message = String(patch.message).slice(0, 500)
    if (patch.documentId != null) job.documentId = String(patch.documentId).slice(0, 80)
    if (patch.progress != null) {
      const progress = Number(patch.progress)
      if (Number.isFinite(progress)) job.progress = Math.max(job.progress, Math.min(99, Math.max(0, Math.round(progress))))
    }
    job.updatedAt = new Date().toISOString()
  }

  function pump() {
    while (running < concurrency && queue.length) {
      const job = queue.shift()
      running += 1
      job.status = 'running'
      job.startedAt = new Date().toISOString()
      job.updatedAt = job.startedAt
      Promise.resolve()
        .then(() => job.task(patch => update(job, patch)))
        .then(result => {
          job.status = 'completed'
          job.stage = 'completed'
          job.progress = 100
          job.message = String(result?.message || 'Готово').slice(0, 500)
          if (result?.documentId) job.documentId = String(result.documentId)
        })
        .catch(error => {
          job.status = 'failed'
          job.stage = 'failed'
          job.error = String(error?.message || error || 'Неизвестная ошибка').slice(0, 2_000)
          job.message = 'Обработка завершилась с ошибкой'
        })
        .finally(() => {
          job.completedAt = new Date().toISOString()
          job.updatedAt = job.completedAt
          job.task = null
          running -= 1
          trim()
          setImmediate(pump)
        })
    }
  }

  return {
    enqueue({ kind = 'generic', title = 'Задание', documentId = null, provider = null, model = null, task }) {
      if (typeof task !== 'function') throw new TypeError('Для задания необходима функция task')
      const now = new Date().toISOString()
      const job = {
        id: crypto.randomBytes(16).toString('hex'),
        kind: String(kind).slice(0, 80),
        title: String(title).slice(0, 240),
        provider: provider ? String(provider).slice(0, 40) : null,
        model: model ? String(model).slice(0, 160) : null,
        documentId,
        task,
        status: 'queued',
        stage: 'queued',
        progress: 0,
        message: 'Ожидает обработки',
        error: null,
        createdAt: now,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      }
      jobs.set(job.id, job)
      queue.push(job)
      setImmediate(pump)
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

module.exports = { createJobManager }
