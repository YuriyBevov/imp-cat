const express = require('express')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { normalizeExportPayload } = require('./lib/validation.cjs')

const app = express()
const port = Number.parseInt(process.env.PORT || '3100', 10)
const rootDir = __dirname
const publicDir = path.join(rootDir, 'public')
const pythonBin = process.env.PYTHON_BIN || path.join(rootDir, '.venv', 'bin', 'python')

app.disable('x-powered-by')
app.use(express.json({ limit: '20mb' }))
app.use('/vendor/docx-preview', express.static(path.join(rootDir, 'node_modules', 'docx-preview', 'dist')))
app.use('/vendor/jszip', express.static(path.join(rootDir, 'node_modules', 'jszip', 'dist')))
app.use(express.static(publicDir))

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/sample', (request, response) => {
  response.download(path.join(rootDir, 'fixtures', 'sample.docx'), 'icat-grid-sample.docx')
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

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  const status = error.code === 'VALIDATION_ERROR' ? 400 : error.status || 500
  console.error(`[icat-grid] ${request.method} ${request.path}: ${error.message}`)
  response.status(status).json({ error: status >= 500 ? 'Не удалось собрать DOCX' : error.message })
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
        const error = new Error('DOCX exporter timed out')
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

const server = app.listen(port, '127.0.0.1', error => {
  if (error) {
    console.error(`[icat-grid] Не удалось запустить сервер: ${error.message}`)
    process.exitCode = 1
    return
  }
  console.log(`ICAT Grid prototype: http://127.0.0.1:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5_000).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
