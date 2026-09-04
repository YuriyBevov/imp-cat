const express = require('express')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { normalizeExportPayload } = require('./lib/validation.cjs')
const { createStudioRouter } = require('./lib/studio.cjs')
const {
  buildOnlyOfficeConfig,
  isDocxBuffer,
  isValidDocumentId,
  rewriteDownloadUrl,
  sanitizeDocxFilename,
} = require('./lib/onlyoffice.cjs')

const app = express()
const port = Number.parseInt(process.env.PORT || '3100', 10)
const rootDir = __dirname
const publicDir = path.join(rootDir, 'public')
const pythonBin = process.env.PYTHON_BIN || path.join(rootDir, '.venv', 'bin', 'python')
const onlyofficeDir = path.join(rootDir, 'data', 'onlyoffice')
const onlyofficeBrowserUrl = process.env.ONLYOFFICE_SERVER_URL || 'http://127.0.0.1:8080'
const onlyofficeDownloadUrl = process.env.ONLYOFFICE_DOWNLOAD_URL || onlyofficeBrowserUrl
const onlyofficeAppInternalUrl = process.env.ONLYOFFICE_INTERNAL_APP_URL || 'http://host.docker.internal:3100'
const onlyofficeJwtSecret = process.env.ONLYOFFICE_JWT_SECRET || 'icat-onlyoffice-local-secret-change-me'
const segmentIndexVersion = 2

fs.mkdirSync(onlyofficeDir, { recursive: true })

app.disable('x-powered-by')
app.use(express.json({ limit: '20mb' }))
app.use('/vendor/docx-preview', express.static(path.join(rootDir, 'node_modules', 'docx-preview', 'dist')))
app.use('/vendor/jszip', express.static(path.join(rootDir, 'node_modules', 'jszip', 'dist')))
app.get('/', (request, response) => response.sendFile(path.join(publicDir, 'studio.html')))
app.use(express.static(publicDir))

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/sample', (request, response) => {
  response.download(path.join(rootDir, 'fixtures', 'sample.docx'), 'icat-grid-sample.docx')
})

app.get('/api/onlyoffice/status', async (request, response) => {
  try {
    const healthUrl = new URL('/healthcheck', onlyofficeBrowserUrl)
    const healthResponse = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000) })
    if (!healthResponse.ok) throw new Error(`Document Server вернул HTTP ${healthResponse.status}`)
    response.json({
      available: true,
      browserApiUrl: new URL('/web-apps/apps/api/documents/api.js', onlyofficeBrowserUrl).toString(),
      serverUrl: onlyofficeBrowserUrl,
    })
  } catch (error) {
    response.json({
      available: false,
      browserApiUrl: new URL('/web-apps/apps/api/documents/api.js', onlyofficeBrowserUrl).toString(),
      serverUrl: onlyofficeBrowserUrl,
      error: error.message,
    })
  }
})

app.post(
  '/api/onlyoffice/documents',
  express.raw({ type: 'application/octet-stream', limit: '50mb' }),
  async (request, response, next) => {
    try {
      if (!isDocxBuffer(request.body)) {
        const error = new Error('Файл не похож на корректный DOCX')
        error.status = 400
        throw error
      }
      const id = crypto.randomBytes(16).toString('hex')
      const filename = sanitizeDocxFilename(request.get('X-File-Name'))
      const createdAt = new Date().toISOString()
      const metadata = { id, filename, revision: 1, createdAt, updatedAt: createdAt, savedAt: null }
      await Promise.all([
        fs.promises.writeFile(onlyofficeDocumentPath(id), request.body),
        writeOnlyOfficeMetadata(metadata),
      ])
      response.status(201).json(serializeOnlyOfficeMetadata(metadata))
    } catch (error) {
      next(error)
    }
  }
)

app.get('/api/onlyoffice/documents/:id', async (request, response, next) => {
  try {
    const metadata = await readOnlyOfficeMetadata(request.params.id)
    response.set('Cache-Control', 'no-store').json(serializeOnlyOfficeMetadata(metadata))
  } catch (error) {
    next(error)
  }
})

app.get('/api/onlyoffice/documents/:id/config', async (request, response, next) => {
  try {
    const metadata = await readOnlyOfficeMetadata(request.params.id)
    const config = buildOnlyOfficeConfig({
      ...metadata,
      appInternalUrl: onlyofficeAppInternalUrl,
      jwtSecret: onlyofficeJwtSecret,
    })
    response.set('Cache-Control', 'no-store').json(config)
  } catch (error) {
    next(error)
  }
})

app.get('/api/onlyoffice/documents/:id/segments', async (request, response, next) => {
  try {
    const metadata = await readOnlyOfficeMetadata(request.params.id)
    const segmentIndex = await readOnlyOfficeSegmentIndex(metadata)
    response.set('Cache-Control', 'no-store').json(segmentIndex)
  } catch (error) {
    next(error)
  }
})

app.get('/api/onlyoffice/documents/:id/source', async (request, response, next) => {
  try {
    const metadata = await readOnlyOfficeMetadata(request.params.id)
    response.set('Cache-Control', 'no-store')
    response.sendFile(onlyofficeDocumentPath(metadata.id))
  } catch (error) {
    next(error)
  }
})

app.get('/api/onlyoffice/documents/:id/download', async (request, response, next) => {
  try {
    const metadata = await readOnlyOfficeMetadata(request.params.id)
    response.download(onlyofficeDocumentPath(metadata.id), metadata.filename)
  } catch (error) {
    next(error)
  }
})

app.post('/api/onlyoffice/documents/:id/callback', async (request, response) => {
  try {
    const metadata = await readOnlyOfficeMetadata(request.params.id)
    const status = Number(request.body?.status)
    if ((status === 2 || status === 6) && request.body?.url) {
      const downloadUrl = rewriteDownloadUrl(request.body.url, onlyofficeDownloadUrl)
      const downloadResponse = await fetch(downloadUrl, { signal: AbortSignal.timeout(45_000) })
      if (!downloadResponse.ok) throw new Error(`Не удалось получить сохранённый DOCX: HTTP ${downloadResponse.status}`)
      const document = Buffer.from(await downloadResponse.arrayBuffer())
      if (!isDocxBuffer(document)) throw new Error('ONLYOFFICE вернул файл, который не является DOCX')
      const tempPath = `${onlyofficeDocumentPath(metadata.id)}.saving`
      await fs.promises.writeFile(tempPath, document)
      await fs.promises.rename(tempPath, onlyofficeDocumentPath(metadata.id))
      const savedAt = new Date().toISOString()
      await writeOnlyOfficeMetadata({
        ...metadata,
        revision: metadata.revision + 1,
        updatedAt: savedAt,
        savedAt,
      })
    }
    response.json({ error: 0 })
  } catch (error) {
    console.error(`[icat-grid] ONLYOFFICE callback: ${error.message}`)
    response.json({ error: 1 })
  }
})

app.post('/api/export', async (request, response, next) => {
  let tempDir
  try {
    const payload = normalizeExportPayload(request.body)
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-grid-export-'))
    const inputPath = path.join(tempDir, 'layout.json')
    const outputPath = path.join(tempDir, 'export.docx')
    await fs.promises.writeFile(inputPath, JSON.stringify(payload), 'utf8')

    const result = await runProcess(
      pythonBin,
      [path.join(rootDir, 'scripts', 'export_docx.py'), inputPath, outputPath],
      30_000
    )
    if (result.code !== 0) {
      const error = new Error(result.stderr.trim() || 'DOCX exporter failed')
      error.status = 500
      throw error
    }

    const safeTitle = payload.title.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'icat-grid-export'
    response.download(outputPath, `${safeTitle}.docx`, (error) => {
      fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      if (error && !response.headersSent) next(error)
    })
  } catch (error) {
    if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    next(error)
  }
})

app.use('/api/studio', createStudioRouter({ rootDir, pythonBin, runProcess }))

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  const status = error.code === 'VALIDATION_ERROR' ? 400 : error.status || 500
  console.error(`[icat-grid] ${request.method} ${request.path}: ${error.message}`)
  response.status(status).json({ error: error.message || 'Внутренняя ошибка сервера' })
})

function runProcess(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (callback) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback()
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(() => {
        const error = new Error(`Процесс ${path.basename(command)} превысил допустимое время выполнения`)
        error.status = 504
        reject(error)
      })
    }, timeoutMs)
    timer.unref()

    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.once('error', error => finish(() => reject(error)))
    child.once('close', code => finish(() => resolve({ code, stdout, stderr })))
  })
}

function onlyofficeDocumentPath(id) {
  if (!isValidDocumentId(id)) {
    const error = new Error('Документ не найден')
    error.status = 404
    throw error
  }
  return path.join(onlyofficeDir, `${id}.docx`)
}

function onlyofficeMetadataPath(id) {
  if (!isValidDocumentId(id)) {
    const error = new Error('Документ не найден')
    error.status = 404
    throw error
  }
  return path.join(onlyofficeDir, `${id}.json`)
}

function onlyofficeSegmentsPath(id) {
  if (!isValidDocumentId(id)) {
    const error = new Error('Документ не найден')
    error.status = 404
    throw error
  }
  return path.join(onlyofficeDir, `${id}.segments.json`)
}

async function readOnlyOfficeMetadata(id) {
  try {
    return JSON.parse(await fs.promises.readFile(onlyofficeMetadataPath(id), 'utf8'))
  } catch (error) {
    if (error.status === 404) throw error
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      const notFound = new Error('Документ не найден')
      notFound.status = 404
      throw notFound
    }
    throw error
  }
}

async function writeOnlyOfficeMetadata(metadata) {
  const target = onlyofficeMetadataPath(metadata.id)
  const temp = `${target}.writing`
  await fs.promises.writeFile(temp, JSON.stringify(metadata, null, 2), 'utf8')
  await fs.promises.rename(temp, target)
}

async function readOnlyOfficeSegmentIndex(metadata) {
  const cachePath = onlyofficeSegmentsPath(metadata.id)
  try {
    const cached = JSON.parse(await fs.promises.readFile(cachePath, 'utf8'))
    if (
      cached.version === segmentIndexVersion
      && cached.documentRevision === metadata.revision
      && Array.isArray(cached.segments)
    ) return cached
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
  }

  const result = await runProcess(
    pythonBin,
    [path.join(rootDir, 'scripts', 'extract_docx_segments.py'), onlyofficeDocumentPath(metadata.id)],
    30_000
  )
  if (result.code !== 0) {
    const error = new Error(result.stderr.trim() || 'Не удалось извлечь сегменты из DOCX')
    error.status = 500
    throw error
  }

  let extracted
  try {
    extracted = JSON.parse(result.stdout)
  } catch {
    const error = new Error('Модуль сегментации вернул некорректный результат')
    error.status = 500
    throw error
  }
  const index = {
    ...extracted,
    documentId: metadata.id,
    documentRevision: metadata.revision,
    generatedAt: new Date().toISOString(),
  }
  const tempPath = `${cachePath}.writing`
  await fs.promises.writeFile(tempPath, JSON.stringify(index), 'utf8')
  await fs.promises.rename(tempPath, cachePath)
  return index
}

function serializeOnlyOfficeMetadata(metadata) {
  return {
    ...metadata,
    configUrl: `/api/onlyoffice/documents/${metadata.id}/config`,
    downloadUrl: `/api/onlyoffice/documents/${metadata.id}/download`,
    segmentsUrl: `/api/onlyoffice/documents/${metadata.id}/segments`,
  }
}

const listenHost = process.env.HOST || '127.0.0.1'
const server = app.listen(port, listenHost, error => {
  if (error) {
    console.error(`[icat-grid] Не удалось запустить сервер: ${error.message}`)
    process.exitCode = 1
    return
  }
  console.log(`ICAT Grid prototype: http://127.0.0.1:${port}`)
  if (listenHost !== '127.0.0.1') console.log(`ICAT bind address: ${listenHost}`)
})

function shutdown() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5_000).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
