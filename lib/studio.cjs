const express = require('express')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')
const {
  TRANSLATABLE_TYPES,
  buildSceneFromAgent,
  validateScene,
} = require('./studio-model.cjs')
const { createKnowledgeBase } = require('./knowledge-base.cjs')
const { ensureTranslationUnits, syncObjectTranslation } = require('../public/translation-units.js')
const { analyzeDocumentWithCodex } = require('./document-agent.cjs')
const { analyzeDocumentWithAitunnel } = require('./api-document-agent.cjs')
const { mergeBatchAnalyses, planDocumentBatches } = require('./document-batching.cjs')
const { fetchAitunnelModels, testAitunnelConnection } = require('./aitunnel.cjs')
const { createCredentialVault } = require('./credential-vault.cjs')
const { updateEnvCredentials } = require('./env-credentials.cjs')
const { createJobManager } = require('./job-manager.cjs')

const DOCUMENT_ID = /^[a-f0-9]{32}$/
const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.heic', '.bmp'])
const MAX_OBJECTS = 12_000

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function safeFilename(value) {
  let decoded = String(value || 'document')
  try { decoded = decodeURIComponent(decoded) } catch {}
  return path.basename(decoded).replace(/[\u0000-\u001f/\\]/g, '_').slice(0, 240) || 'document'
}

function finite(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

function secureProviderUrl(value) {
  let url
  try { url = new URL(String(value)) } catch { throw new Error('Некорректный URL AI-провайдера') }
  if (url.protocol !== 'https:') throw new Error('AI-провайдер должен использовать HTTPS')
  return url.toString()
}

function normalizeTextStyles(ranges, text) {
  const length = String(text || '').length
  if (!Array.isArray(ranges) || !length) return []
  return ranges.slice(0, 2_000).map(range => {
    const start = Math.trunc(finite(range?.start, 0, 0, length))
    const end = Math.trunc(finite(range?.end, start, start, length))
    const normalized = { start, end }
    if (range?.fontSizePx != null) normalized.fontSizePx = finite(range.fontSizePx, 14, 6, 96)
    if (range?.fontWeight != null) normalized.fontWeight = finite(range.fontWeight, 400, 100, 900)
    if (range?.fontStyle != null) normalized.fontStyle = range.fontStyle === 'italic' ? 'italic' : 'normal'
    if (/^#[0-9a-f]{6}$/i.test(range?.color)) normalized.color = range.color
    return normalized
  }).filter(range => range.end > range.start && Object.keys(range).length > 2)
}

function initializeSceneTranslationUnits(scene) {
  for (const object of scene?.objects || []) {
    if (TRANSLATABLE_TYPES.has(object.type)) ensureTranslationUnits(object)
  }
  return scene
}

function normalizeScene(scene, documentId, title) {
  if (!scene || !Array.isArray(scene.pages) || !Array.isArray(scene.objects)) {
    throw httpError(400, 'Некорректная сцена документа')
  }
  if (!scene.pages.length || scene.pages.length > 400 || scene.objects.length > MAX_OBJECTS) {
    throw httpError(400, 'Некорректное количество страниц или сегментов')
  }
  const pages = scene.pages.map((page, index) => ({
    index,
    widthPx: finite(page.widthPx, 794, 300, 2_500),
    heightPx: finite(page.heightPx, 1123, 300, 4_000),
    sourceWidth: finite(page.sourceWidth, 794, 1, 20_000),
    sourceHeight: finite(page.sourceHeight, 1123, 1, 20_000),
    imageUrl: `/api/studio/documents/${documentId}/pages/${index}/image`,
    sourceFrame: {
      x: finite(page.sourceFrame?.x, 0, 0, 2_500),
      y: finite(page.sourceFrame?.y, 0, 0, 4_000),
      width: finite(page.sourceFrame?.width, page.widthPx, 1, 2_500),
      height: finite(page.sourceFrame?.height, page.heightPx, 1, 4_000),
    },
    contentBounds: {
      x: finite(page.contentBounds?.x, 40, 0, 2_500),
      y: finite(page.contentBounds?.y, 40, 0, 4_000),
      width: finite(page.contentBounds?.width, 714, 1, 2_500),
      height: finite(page.contentBounds?.height, 1043, 1, 4_000),
    },
    languages: Array.isArray(page.languages) ? page.languages.map(String).filter(Boolean).slice(0, 20) : [],
  }))
  const seen = new Set()
  const objects = scene.objects.map((object, index) => {
    const id = String(object?.id || `object-${index + 1}`).slice(0, 120)
    if (seen.has(id)) throw httpError(400, `Повторяющийся ID сегмента: ${id}`)
    seen.add(id)
    const pageIndex = Math.trunc(finite(object.pageIndex, 0, 0, pages.length - 1))
    const page = pages[pageIndex]
    const type = ['text', 'table', 'table_cell', 'stamp', 'seal', 'signature', 'handwriting', 'logo', 'image', 'unknown'].includes(object.type)
      ? object.type
      : 'text'
    const sourceText = String(object.sourceText || '').slice(0, 100_000)
    const translation = String(object.translation || '').slice(0, 100_000)
    const normalized = {
      id,
      pageIndex,
      type,
      readingOrder: Math.trunc(finite(object.readingOrder, index + 1, 0, MAX_OBJECTS)),
      sourceText,
      translation,
      confidence: finite(object.confidence, 1, 0, 1),
      x: finite(object.x, 0, -page.widthPx, page.widthPx * 2),
      y: finite(object.y, 0, -page.heightPx, page.heightPx * 2),
      width: finite(object.width, 120, 12, page.widthPx * 2),
      height: finite(object.height, 32, 12, page.heightPx * 2),
      rotation: finite(object.rotation, 0, -360, 360),
      excluded: Boolean(object.excluded),
      status: String(object.status || 'recognized').slice(0, 40),
      objectLabel: String(object.objectLabel || '').slice(0, 120),
      flowGroup: String(object.flowGroup || `page-${pageIndex + 1}-body`).slice(0, 120),
      needsReview: Boolean(object.needsReview),
      agentNotes: String(object.agentNotes || '').slice(0, 1_000),
      agentRequestedFontSizePx: finite(object.agentRequestedFontSizePx, object.style?.fontSizePx || 14, 6, 96),
      style: {
        fontFamily: String(object.style?.fontFamily || 'Arial').slice(0, 120),
        fontSizePx: finite(object.style?.fontSizePx, 14, 6, 96),
        fontWeight: finite(object.style?.fontWeight, 400, 100, 900),
        fontStyle: object.style?.fontStyle === 'italic' ? 'italic' : 'normal',
        textAlign: ['left', 'center', 'right', 'justify'].includes(object.style?.textAlign) ? object.style.textAlign : 'left',
        lineHeight: finite(object.style?.lineHeight, 1.2, 0.8, 3),
        color: /^#[0-9a-f]{6}$/i.test(object.style?.color) ? object.style.color : '#111827',
      },
      sourceLineIds: Array.isArray(object.sourceLineIds) ? object.sourceLineIds.map(String).slice(0, 100) : [],
      recognitionSources: Array.isArray(object.recognitionSources) ? object.recognitionSources.map(String).slice(0, 20) : [],
      sourceTextStyles: normalizeTextStyles(object.sourceTextStyles, sourceText),
      translationTextStyles: normalizeTextStyles(object.translationTextStyles, translation),
      sourceRegions: Array.isArray(object.sourceRegions) ? object.sourceRegions.slice(0, 100).map(region => ({
        x: finite(region?.x, 0, 0, 1),
        y: finite(region?.y, 0, 0, 1),
        width: finite(region?.width, 0, 0, 1),
        height: finite(region?.height, 0, 0, 1),
      })).filter(region => region.width > 0 && region.height > 0) : [],
      originalBounds: {
        x: finite(object.originalBounds?.x, object.x, -page.widthPx, page.widthPx * 2),
        y: finite(object.originalBounds?.y, object.y, -page.heightPx, page.heightPx * 2),
        width: finite(object.originalBounds?.width, object.width, 12, page.widthPx * 2),
        height: finite(object.originalBounds?.height, object.height, 12, page.heightPx * 2),
      },
    }
    normalized.translationUnits = Array.isArray(object.translationUnits)
      ? object.translationUnits.slice(0, 500).map(unit => ({
        id: String(unit?.id || '').slice(0, 120),
        sourceText: String(unit?.sourceText || '').slice(0, 100_000),
        separatorAfter: String(unit?.separatorAfter || '').slice(0, 200),
        translation: String(unit?.translation || '').slice(0, 100_000),
        status: String(unit?.status || 'new').slice(0, 40),
        memorySuggestion: unit?.memorySuggestion && typeof unit.memorySuggestion === 'object' ? {
          entryId: String(unit.memorySuggestion.entryId || unit.memorySuggestion.id || '').slice(0, 120),
          translation: String(unit.memorySuggestion.translation || '').slice(0, 100_000),
          score: finite(unit.memorySuggestion.score, 0, 0, 1),
          matchType: unit.memorySuggestion.matchType === 'exact' ? 'exact' : 'vector',
          targetLanguage: String(unit.memorySuggestion.targetLanguage || '').slice(0, 20),
        } : null,
        memoryEntryId: unit?.memoryEntryId ? String(unit.memoryEntryId).slice(0, 120) : null,
      }))
      : []
    if (TRANSLATABLE_TYPES.has(type)) {
      ensureTranslationUnits(normalized)
      syncObjectTranslation(normalized)
    } else {
      normalized.translationUnits = []
    }
    return normalized
  })
  return {
    version: 1,
    documentId,
    title: String(scene.title || title || 'Документ').slice(0, 240),
    sourceLanguage: String(scene.sourceLanguage || 'auto').slice(0, 20),
    targetLanguage: String(scene.targetLanguage || 'ru').slice(0, 20),
    gridSize: finite(scene.gridSize, 8, 4, 96),
    snapToGrid: scene.snapToGrid !== false,
    pages,
    objects,
    recognition: scene.recognition && typeof scene.recognition === 'object' ? {
      mode: String(scene.recognition.mode || '').slice(0, 40),
      engine: String(scene.recognition.engine || '').slice(0, 160),
      model: scene.recognition.model ? String(scene.recognition.model).slice(0, 120) : null,
      languages: Array.isArray(scene.recognition.languages)
        ? scene.recognition.languages.map(String).filter(Boolean).slice(0, 20)
        : [],
      generatedAt: String(scene.recognition.generatedAt || '').slice(0, 80),
    } : null,
    updatedAt: new Date().toISOString(),
  }
}

function parseJsonArray(content) {
  const value = Array.isArray(content)
    ? content.map(item => typeof item === 'string' ? item : item?.text || '').join('').trim()
    : String(content || '').trim()
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.items)) return parsed.items
    if (Array.isArray(parsed?.suggestions)) return parsed.suggestions
  } catch {}
  const fenced = value.match(/```(?:json)?\s*(\[[\s\S]*?])\s*```/i)
  if (!fenced) throw new Error('Модель вернула некорректный JSON')
  return JSON.parse(fenced[1])
}

function createStudioRouter(options) {
  const {
    rootDir,
    pythonBin,
    runProcess,
    dataDir = path.join(rootDir, 'data', 'studio'),
  } = options
  const router = express.Router()
  const analyzerScript = path.join(rootDir, 'scripts', 'document_analyzer.py')
  const exporterScript = path.join(rootDir, 'scripts', 'export_studio.py')
  const documentAgentSchema = path.join(rootDir, 'schemas', 'document-analysis.schema.json')
  const memoryPath = path.join(dataDir, 'translation-memory.json')
  const knowledgeBase = createKnowledgeBase({ filePath: memoryPath, maximumEntries: 20_000 })
  const providerEnvPath = path.join(rootDir, '.env')
  fs.mkdirSync(dataDir, { recursive: true })

  const credentialVault = createCredentialVault({
    environmentSecret: process.env.TRANSLATION_API_KEY || process.env.AI_API_KEY || '',
  })
  const jobs = createJobManager({ concurrency: process.env.DOCUMENT_JOB_CONCURRENCY || 2 })
  const initialAiProvider = process.env.AI_PROVIDER || process.env.TRANSLATION_PROVIDER
    || (credentialVault.status().configured ? 'aitunnel' : 'codex')
  let activeAiProvider = String(initialAiProvider).toLowerCase() === 'aitunnel'
    ? 'aitunnel'
    : 'codex'
  const provider = {
    apiUrl: secureProviderUrl(process.env.TRANSLATION_API_URL || process.env.AI_API_URL || 'https://api.aitunnel.ru/v1/chat/completions'),
    model: process.env.TRANSLATION_MODEL || process.env.AI_MODEL || '',
  }
  let aitunnelVerification = null
  let providerKeyPersisted = Boolean(process.env.TRANSLATION_API_KEY || process.env.AI_API_KEY)
  Object.defineProperty(provider, 'apiKey', { enumerable: false, get: () => credentialVault.getSecret() })
  const documentAgent = {
    codexBin: process.env.CODEX_BIN || 'codex',
    model: process.env.CODEX_DOCUMENT_MODEL || 'gpt-5.6-sol',
    timeoutMs: Math.trunc(finite(process.env.CODEX_DOCUMENT_TIMEOUT_MS, 900_000, 60_000, 3_600_000)),
    batchPageLimit: Math.trunc(finite(process.env.DOCUMENT_AGENT_BATCH_PAGES, 2, 1, 4)),
    uploadMaxBytes: Math.trunc(finite(process.env.DOCUMENT_UPLOAD_MAX_MB, 300, 10, 2_048) * 1024 * 1024),
  }

  async function readCodexStatus() {
    let available = false
    let authenticated = false
    let error = null
    try {
      const result = await runProcess(documentAgent.codexBin, ['login', 'status'], 10_000)
      available = result.code === 0
      authenticated = result.code === 0 && /logged in/iu.test(`${result.stdout}\n${result.stderr}`)
      if (result.code !== 0) error = String(result.stderr || result.stdout || 'Codex login не настроен').trim().slice(0, 300)
    } catch (statusError) {
      error = statusError?.code === 'ENOENT' ? 'Codex CLI не найден' : String(statusError?.message || statusError).slice(0, 300)
    }
    return { available, authenticated, error }
  }

  function providerSettings(codexStatus = null) {
    const credentialStatus = credentialVault.status()
    const codexReady = Boolean(codexStatus?.available && codexStatus?.authenticated)
    return {
      activeProvider: activeAiProvider,
      aitunnelConfigured: Boolean(credentialStatus.configured && provider.model),
      aitunnelVerified: Boolean(aitunnelVerification && aitunnelVerification.model === provider.model),
      aitunnelVerifiedAt: aitunnelVerification?.verifiedAt || null,
      keyConfigured: credentialStatus.configured,
      keySource: credentialStatus.source,
      keyUpdatedAt: credentialStatus.updatedAt,
      keyPersisted: providerKeyPersisted,
      model: provider.model || '',
      apiHost: new URL(provider.apiUrl).host,
      codexConfigured: codexReady,
      publicKey: credentialVault.publicKeyPem,
      encryptionAlgorithm: credentialVault.algorithm,
      secretPersistence: providerKeyPersisted ? 'server-environment' : 'memory-only',
    }
  }

  async function persistProviderEnvironment(options = {}) {
    const updates = {
      AI_PROVIDER: activeAiProvider,
      TRANSLATION_API_URL: provider.apiUrl,
      TRANSLATION_MODEL: provider.model || '',
    }
    if (options.includeKey) {
      const secret = provider.apiKey
      if (!secret) throw httpError(400, 'Нет API-ключа для сохранения')
      updates.TRANSLATION_API_KEY = secret
      updates.AI_API_KEY = null
    }
    await updateEnvCredentials(providerEnvPath, updates)
    if (options.includeKey) {
      providerKeyPersisted = true
      credentialVault.setEnvironmentSecret(provider.apiKey)
    }
  }

  router.get('/status', async (request, response) => {
    const codexStatus = await readCodexStatus()
    const settings = providerSettings(codexStatus)
    response.json({
      platform: process.platform,
      documentAnalysisMode: activeAiProvider,
      documentAgent: activeAiProvider === 'codex' ? 'Codex CLI' : 'AITunnel API',
      documentAgentModel: activeAiProvider === 'codex' ? documentAgent.model : provider.model || null,
      documentAgentUsesChatGptAuth: activeAiProvider === 'codex',
      codexAvailable: codexStatus.available,
      codexAuthenticated: codexStatus.authenticated,
      codexStatusError: codexStatus.error,
      localAnalyzerAvailable: fs.existsSync(analyzerScript),
      localAnalyzer: 'PyMuPDF/Pillow page renderer',
      aiProvider: activeAiProvider,
      aiProviderConfigured: activeAiProvider === 'codex' ? settings.codexConfigured : settings.aitunnelConfigured,
      translationProvider: activeAiProvider,
      translationProviderConfigured: activeAiProvider === 'codex' ? settings.codexConfigured : settings.aitunnelConfigured,
      translationModel: activeAiProvider === 'codex' ? documentAgent.model : provider.model || null,
      documentAnalysisBatchPages: documentAgent.batchPageLimit,
      documentUploadMaxMb: Math.round(documentAgent.uploadMaxBytes / 1024 / 1024),
      supportedInputs: [...ACCEPTED_EXTENSIONS],
      supportedExports: ['docx', 'pdf'],
    })
  })

  router.get('/provider', async (request, response) => {
    response.set('Cache-Control', 'no-store').json(providerSettings(await readCodexStatus()))
  })

  router.get('/provider/models', async (request, response, next) => {
    try {
      let catalog
      try {
        catalog = await fetchAitunnelModels({ apiUrl: provider.apiUrl, apiKey: provider.apiKey })
      } catch (error) {
        catalog = await fetchAitunnelModels({ apiUrl: provider.apiUrl })
        catalog.authenticationError = true
      }
      response.set('Cache-Control', 'no-store').json(catalog)
    } catch (error) { next(httpError(502, error.message)) }
  })

  router.post('/provider/test', async (request, response, next) => {
    try {
      const requestedProvider = String(request.body?.provider || activeAiProvider).toLowerCase()
      if (requestedProvider === 'codex') {
        const status = await readCodexStatus()
        if (!status.available || !status.authenticated) throw httpError(409, status.error || 'Codex CLI не авторизован')
        return response.set('Cache-Control', 'no-store').json({
          ok: true, provider: 'codex', model: documentAgent.model, message: `Codex готов · ${documentAgent.model}`,
        })
      }
      if (requestedProvider !== 'aitunnel') throw httpError(400, 'Неизвестный AI-провайдер')
      const result = await testAitunnelConnection({
        apiUrl: provider.apiUrl,
        apiKey: provider.apiKey,
        model: provider.model,
      })
      aitunnelVerification = {
        model: result.model,
        verifiedAt: new Date().toISOString(),
        maxOutput: result.maxOutput,
      }
      if (request.body?.persistKey) await persistProviderEnvironment({ includeKey: true })
      response.set('Cache-Control', 'no-store').json({
        ...result,
        message: `AITunnel подключён · ${result.model} · доступно моделей: ${result.modelsCount}`,
      })
    } catch (error) { next(error.status ? error : httpError(502, error.message)) }
  })

  router.put('/provider', async (request, response, next) => {
    try {
      const requestedProvider = String(request.body?.provider || activeAiProvider).toLowerCase()
      if (!['aitunnel', 'codex'].includes(requestedProvider)) throw httpError(400, 'Неизвестный AI-провайдер')
      const model = String(request.body?.model || provider.model).trim().slice(0, 160)
      if (request.body?.encryptedApiKey) {
        credentialVault.setEncrypted(request.body.encryptedApiKey)
        aitunnelVerification = null
      }
      if (model && model !== provider.model) aitunnelVerification = null
      if (model) provider.model = model
      activeAiProvider = requestedProvider
      const settings = providerSettings(await readCodexStatus())
      if (requestedProvider === 'aitunnel' && !settings.keyConfigured) throw httpError(400, 'Введите ключ AITunnel')
      if (requestedProvider === 'aitunnel' && !settings.model) throw httpError(400, 'Укажите модель AITunnel')
      if (request.body?.persistKey && requestedProvider === 'aitunnel') {
        await persistProviderEnvironment({ includeKey: true })
      } else if (providerKeyPersisted) {
        await persistProviderEnvironment()
      }
      response.set('Cache-Control', 'no-store').json(providerSettings(await readCodexStatus()))
    } catch (error) { next(error) }
  })

  router.delete('/provider/key', async (request, response, next) => {
    try {
      await updateEnvCredentials(providerEnvPath, { TRANSLATION_API_KEY: null, AI_API_KEY: null })
      credentialVault.clearSession()
      credentialVault.setEnvironmentSecret('')
      providerKeyPersisted = false
      aitunnelVerification = null
      response.set('Cache-Control', 'no-store').json(providerSettings(await readCodexStatus()))
    } catch (error) { next(error) }
  })

  function captureAiRoute() {
    if (activeAiProvider === 'codex') return { provider: 'codex', model: documentAgent.model }
    if (!provider.apiKey) throw httpError(409, 'Не настроен API-ключ AITunnel')
    if (!provider.model) throw httpError(409, 'Не выбрана модель AITunnel')
    const currentVerification = aitunnelVerification?.model === provider.model ? aitunnelVerification : null
    return {
      provider: 'aitunnel', model: provider.model, apiUrl: provider.apiUrl,
      credentialFingerprint: crypto.createHash('sha256').update(provider.apiKey).digest('hex'),
      modelMaxOutputTokens: Number.isFinite(Number(currentVerification?.maxOutput)) && Number(currentVerification.maxOutput) > 0
        ? Math.trunc(Number(currentVerification.maxOutput))
        : null,
    }
  }

  function numberedOutputPath(basePath, directory, fallbackName, batch, batchCount) {
    const target = basePath || path.join(directory, fallbackName)
    if (batchCount === 1) return target
    const extension = path.extname(target) || '.json'
    const basename = path.basename(target, extension)
    return path.join(path.dirname(target), `${basename}-batch-${String(batch + 1).padStart(3, '0')}${extension}`)
  }

  async function analyzeRenderedDocument(route, upload, manifest, outputPath, reportProgress = () => {}) {
    if (route.provider === 'aitunnel') {
      if (!provider.apiKey) throw httpError(409, 'Не настроен API-ключ AITunnel')
      const fingerprint = crypto.createHash('sha256').update(provider.apiKey).digest('hex')
      if (provider.model !== route.model || provider.apiUrl !== route.apiUrl || fingerprint !== route.credentialFingerprint) {
        throw httpError(409, 'Настройки AITunnel изменились после постановки задания в очередь. Повторите загрузку')
      }
      if (!route.model) throw httpError(409, 'Не выбрана модель AITunnel')
    }

    const batches = planDocumentBatches(manifest, {
      pageLimit: documentAgent.batchPageLimit,
      modelMaxOutputTokens: route.provider === 'aitunnel' ? route.modelMaxOutputTokens : null,
    })
    const results = []
    for (const batch of batches) {
      const pageRange = batch.startPage === batch.endPage
        ? `страницу ${batch.startPage}`
        : `страницы ${batch.startPage}–${batch.endPage}`
      reportProgress({
        stage: 'analysis',
        progress: 30 + Math.floor((batch.batchIndex / batch.batchCount) * 56),
        message: `Агент анализирует ${pageRange} из ${manifest.pages.length} · пакет ${batch.batchNumber}/${batch.batchCount}`,
      })
      let analysis
      try {
        if (route.provider === 'aitunnel') {
          const diagnosticPath = numberedOutputPath(
            null,
            upload.directory,
            'aitunnel-analysis-response.json',
            batch.batchIndex,
            batch.batchCount,
          )
          analysis = await analyzeDocumentWithAitunnel({
            apiUrl: route.apiUrl,
            apiKey: provider.apiKey,
            model: route.model,
            documentDirectory: upload.directory,
            filename: upload.filename,
            manifest: batch.manifest,
            schemaPath: documentAgentSchema,
            timeoutMs: documentAgent.timeoutMs,
            maxOutputTokens: batch.maxOutputTokens,
            diagnosticFilename: path.basename(diagnosticPath),
          })
        } else {
          analysis = await analyzeDocumentWithCodex({
            codexBin: documentAgent.codexBin,
            model: documentAgent.model,
            workdir: upload.directory,
            documentDirectory: upload.directory,
            filename: upload.filename,
            manifest: batch.manifest,
            schemaPath: documentAgentSchema,
            outputPath: numberedOutputPath(
              outputPath,
              upload.directory,
              'codex-analysis.json',
              batch.batchIndex,
              batch.batchCount,
            ),
            timeoutMs: documentAgent.timeoutMs,
            runProcess,
          })
        }
      } catch (error) {
        error.message = `Не удалось проанализировать ${pageRange} из ${manifest.pages.length}: ${error.message}`
        throw error
      }
      await writeJson(path.join(
        upload.directory,
        `agent-analysis-batch-${String(batch.batchNumber).padStart(3, '0')}.json`,
      ), analysis)
      results.push({ batch, analysis })
      reportProgress({
        stage: 'analysis',
        progress: 30 + Math.floor((batch.batchNumber / batch.batchCount) * 56),
        message: `Готово ${batch.endPage} из ${manifest.pages.length} страниц`,
      })
    }
    return mergeBatchAnalyses(results, manifest)
  }

  async function storeUploadRequest(request, rawFilename) {
    const filename = safeFilename(rawFilename)
    const extension = path.extname(filename).toLowerCase()
    if (!ACCEPTED_EXTENSIONS.has(extension)) throw httpError(400, 'Поддерживаются PDF и растровые изображения')
    const declaredLength = Number(request.get('Content-Length'))
    if (Number.isFinite(declaredLength) && declaredLength > documentAgent.uploadMaxBytes) {
      throw httpError(413, `Файл превышает лимит ${Math.round(documentAgent.uploadMaxBytes / 1024 / 1024)} МБ`)
    }
    const id = crypto.randomBytes(16).toString('hex')
    const directory = documentDirectory(id)
    const pagesDirectory = path.join(directory, 'pages')
    await fs.promises.mkdir(pagesDirectory, { recursive: true })
    const sourcePath = path.join(directory, `source${extension}`)
    let received = 0
    try {
      await pipeline(
        request,
        async function* enforceUploadLimit(source) {
          for await (const chunk of source) {
            received += chunk.length
            if (received > documentAgent.uploadMaxBytes) {
              throw httpError(413, `Файл превышает лимит ${Math.round(documentAgent.uploadMaxBytes / 1024 / 1024)} МБ`)
            }
            yield chunk
          }
        },
        fs.createWriteStream(sourcePath, { flags: 'wx' }),
      )
      if (received < 16) throw httpError(400, 'Файл пуст или повреждён')
      return { id, filename, extension, directory, pagesDirectory, sourcePath }
    } catch (error) {
      await fs.promises.rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  async function readStoredUpload(documentId, originalFilename) {
    if (!DOCUMENT_ID.test(String(documentId || ''))) throw httpError(404, 'Исходник задания не найден')
    const directory = documentDirectory(documentId)
    let entries
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') throw httpError(404, 'Исходник задания больше не доступен')
      throw error
    }
    const source = entries.find(entry => {
      if (!entry.isFile() || !entry.name.startsWith('source.')) return false
      return ACCEPTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    })
    if (!source) throw httpError(404, 'Исходник задания больше не доступен')
    const extension = path.extname(source.name).toLowerCase()
    return {
      id: documentId,
      filename: safeFilename(originalFilename || `document${extension}`),
      extension,
      directory,
      pagesDirectory: path.join(directory, 'pages'),
      sourcePath: path.join(directory, source.name),
    }
  }

  async function processStoredUpload(upload, reportProgress = () => {}, route = captureAiRoute()) {
    const { id, filename, extension, directory, pagesDirectory, sourcePath } = upload
    const analysisPath = path.join(directory, 'analysis.json')
    reportProgress({ stage: 'rendering', progress: 10, message: 'Подготавливаем изображения страниц' })
    const analyzerArguments = [analyzerScript, sourcePath, pagesDirectory, analysisPath]
    const result = await runProcess(pythonBin, analyzerArguments, 900_000)
    if (result.code !== 0) throw httpError(500, result.stderr.trim() || 'Не удалось подготовить страницы документа')
    const renderedAnalysis = JSON.parse(await fs.promises.readFile(analysisPath, 'utf8'))
    if (!renderedAnalysis.pages?.length) throw httpError(422, 'В документе не найдено страниц')
    reportProgress({ stage: 'analysis', progress: 30, message: `Агент анализирует ${renderedAnalysis.pages.length} стр.` })
    const analysis = await analyzeRenderedDocument(route, upload, renderedAnalysis, undefined, reportProgress)
    await writeJson(analysisPath, analysis)
    reportProgress({ stage: 'scene', progress: 88, message: 'Собираем редактируемые сегменты' })
    const sceneOptions = {
      documentId: id,
      title: path.basename(filename, extension),
      fitRasterToA4: false,
      model: route.model,
      mode: route.provider,
      recognitionSource: `${route.provider}-document-agent`,
    }
    const scene = initializeSceneTranslationUnits(buildSceneFromAgent(analysis, sceneOptions))
    const now = new Date().toISOString()
    const metadata = {
      id,
      filename,
      extension,
      title: scene.title,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      revision: 1,
      pageCount: scene.pages.length,
      objectCount: scene.objects.length,
      analyzer: analysis.engine,
      analysisMode: route.provider,
      analysisModel: analysis.model || route.model,
      analysisUsage: analysis.usage || null,
      analysisBatchCount: analysis.batchCount || 1,
    }
    await Promise.all([writeJson(metadataPath(id), metadata), writeJson(scenePath(id), scene)])
    reportProgress({ stage: 'saving', progress: 97, message: 'Сохраняем проект' })
    return serializeDocument(metadata, scene)
  }

  function enqueueDocumentAnalysis(upload, route) {
    return jobs.enqueue({
      kind: 'document-analysis',
      title: upload.filename,
      documentId: upload.id,
      provider: route.provider,
      model: route.model,
      task: async update => {
        const documentData = await processStoredUpload(upload, update, route)
        return {
          documentId: documentData.metadata.id,
          message: `${documentData.scene.pages.length} стр. · ${documentData.scene.objects.length} сегментов`,
        }
      },
    })
  }

  router.post(
    '/documents',
    async (request, response, next) => {
      try {
        const route = captureAiRoute()
        const upload = await storeUploadRequest(request, request.get('X-File-Name'))
        const documentData = await processStoredUpload(upload, () => {}, route)
        response.status(201).json(documentData)
      } catch (error) {
        next(error)
      }
    }
  )

  router.post(
    '/jobs',
    async (request, response, next) => {
      try {
        const route = captureAiRoute()
        const upload = await storeUploadRequest(request, request.get('X-File-Name'))
        const job = enqueueDocumentAnalysis(upload, route)
        response.status(202).set('Location', `/api/studio/jobs/${job.id}`).json({ job })
      } catch (error) { next(error) }
    }
  )

  router.get('/jobs', (request, response) => {
    response.set('Cache-Control', 'no-store').json({ jobs: jobs.list() })
  })

  router.get('/jobs/:id', (request, response, next) => {
    const job = jobs.get(request.params.id)
    if (!job) return next(httpError(404, 'Задание не найдено'))
    response.set('Cache-Control', 'no-store').json({ job })
  })

  const retriedJobs = new Set()
  router.post('/jobs/:id/retry', async (request, response, next) => {
    try {
      const failedJob = jobs.get(request.params.id)
      if (!failedJob) throw httpError(404, 'Задание не найдено')
      if (failedJob.kind !== 'document-analysis' || failedJob.status !== 'failed') {
        throw httpError(409, 'Повторить можно только завершившееся с ошибкой задание')
      }
      if (retriedJobs.has(failedJob.id)) throw httpError(409, 'Повторная обработка этого задания уже запущена')
      const route = captureAiRoute()
      const upload = await readStoredUpload(failedJob.documentId, failedJob.title)
      const job = enqueueDocumentAnalysis(upload, route)
      retriedJobs.add(failedJob.id)
      response.status(202).set('Location', `/api/studio/jobs/${job.id}`).json({ job })
    } catch (error) { next(error) }
  })

  router.get('/documents', async (request, response, next) => {
    try {
      const scope = ['active', 'archived', 'all'].includes(String(request.query.scope))
        ? String(request.query.scope)
        : 'active'
      const entries = await fs.promises.readdir(dataDir, { withFileTypes: true })
      const documents = []
      for (const entry of entries) {
        if (!entry.isDirectory() || !DOCUMENT_ID.test(entry.name)) continue
        try {
          const metadata = await readMetadata(entry.name)
          const archived = Boolean(metadata.archivedAt)
          if (scope === 'active' && archived) continue
          if (scope === 'archived' && !archived) continue
          documents.push(metadata)
        } catch (error) {
          if (error.status !== 404) throw error
        }
      }
      documents.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      response.set('Cache-Control', 'no-store').json({ documents: documents.slice(0, 100) })
    } catch (error) { next(error) }
  })

  router.post('/documents/:id/archive', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const now = new Date().toISOString()
      const updatedMetadata = { ...metadata, archivedAt: metadata.archivedAt || now, updatedAt: now }
      await writeJson(metadataPath(metadata.id), updatedMetadata)
      response.json({ metadata: updatedMetadata })
    } catch (error) { next(error) }
  })

  router.delete('/documents/:id/archive', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const updatedMetadata = { ...metadata, archivedAt: null, updatedAt: new Date().toISOString() }
      await writeJson(metadataPath(metadata.id), updatedMetadata)
      response.json({ metadata: updatedMetadata })
    } catch (error) { next(error) }
  })

  router.delete('/documents/:id', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      if (request.get('X-Confirm-Document-Id') !== metadata.id) {
        throw httpError(400, 'Для удаления нужно явное подтверждение документа')
      }
      await fs.promises.rm(documentDirectory(metadata.id), { recursive: true, force: false })
      response.status(204).end()
    } catch (error) { next(error) }
  })

  router.get('/documents/:id', async (request, response, next) => {
    try {
      const [metadata, scene] = await Promise.all([readMetadata(request.params.id), readScene(request.params.id)])
      response.set('Cache-Control', 'no-store').json(serializeDocument(metadata, scene))
    } catch (error) { next(error) }
  })

  router.get('/documents/:id/pages/:page/image', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const pageIndex = Number.parseInt(request.params.page, 10)
      if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= metadata.pageCount) throw httpError(404, 'Страница не найдена')
      response.set('Cache-Control', 'private, max-age=3600')
      response.sendFile(path.join(documentDirectory(metadata.id), 'pages', `page-${String(pageIndex + 1).padStart(3, '0')}.png`))
    } catch (error) { next(error) }
  })

  router.put('/documents/:id/scene', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const scene = normalizeScene(request.body, metadata.id, metadata.title)
      const updatedAt = new Date().toISOString()
      const updatedMetadata = {
        ...metadata,
        updatedAt,
        revision: metadata.revision + 1,
        pageCount: scene.pages.length,
        objectCount: scene.objects.length,
      }
      await Promise.all([writeJson(scenePath(metadata.id), scene), writeJson(metadataPath(metadata.id), updatedMetadata)])
      response.json(serializeDocument(updatedMetadata, scene))
    } catch (error) { next(error) }
  })

  router.post('/documents/:id/agent/analyze', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const scene = await readScene(metadata.id)
      for (const page of scene.pages) {
        const objects = scene.objects.filter(object => object.pageIndex === page.index && !object.excluded)
          .sort((left, right) => left.y - right.y || left.x - right.x)
        objects.forEach((object, index) => { object.readingOrder = index + 1 })
      }
      const report = validateScene(scene)
      scene.updatedAt = new Date().toISOString()
      await writeJson(scenePath(metadata.id), scene)
      response.json({ scene, report, summary: buildAgentSummary(scene, report) })
    } catch (error) { next(error) }
  })

  router.post('/documents/:id/agent/reanalyze', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const previousScene = await readScene(metadata.id)
      const directory = documentDirectory(metadata.id)
      const route = captureAiRoute()
      const analysisPath = path.join(directory, 'analysis.json')
      const manifest = {
        pages: previousScene.pages.map(page => ({
          index: page.index,
          width: page.sourceWidth,
          height: page.sourceHeight,
          image: `page-${String(page.index + 1).padStart(3, '0')}.png`,
        })),
      }
      const analysis = await analyzeRenderedDocument(route, {
        id: metadata.id,
        filename: metadata.filename,
        directory,
      }, manifest, route.provider === 'codex'
        ? path.join(directory, `codex-analysis-r${metadata.revision + 1}.json`)
        : undefined)
      const revisionsDirectory = path.join(directory, 'analysis-revisions')
      await fs.promises.mkdir(revisionsDirectory, { recursive: true })
      try {
        await fs.promises.copyFile(analysisPath, path.join(revisionsDirectory, `analysis-r${metadata.revision}.json`))
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      await writeJson(analysisPath, analysis)
      const scene = initializeSceneTranslationUnits(buildSceneFromAgent(analysis, {
        documentId: metadata.id,
        title: metadata.title,
        fitRasterToA4: false,
        model: analysis.model || route.model,
        mode: route.provider,
        recognitionSource: `${route.provider}-document-agent`,
      }))
      const updatedMetadata = {
        ...metadata,
        title: scene.title,
        updatedAt: new Date().toISOString(),
        revision: metadata.revision + 1,
        pageCount: scene.pages.length,
        objectCount: scene.objects.length,
        analyzer: analysis.engine,
        analysisMode: route.provider,
        analysisModel: analysis.model || route.model,
        analysisUsage: analysis.usage || null,
      }
      await Promise.all([writeJson(scenePath(metadata.id), scene), writeJson(metadataPath(metadata.id), updatedMetadata)])
      response.json(serializeDocument(updatedMetadata, scene))
    } catch (error) { next(error) }
  })

  router.post('/documents/:id/agent/auto-layout', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const scene = await readScene(metadata.id)
      autoLayout(scene, Array.isArray(request.body?.objectIds) ? request.body.objectIds.map(String) : null)
      scene.updatedAt = new Date().toISOString()
      await writeJson(scenePath(metadata.id), scene)
      response.json({ scene, report: validateScene(scene) })
    } catch (error) { next(error) }
  })

  router.get('/documents/:id/qa', async (request, response, next) => {
    try {
      const scene = await readScene(request.params.id)
      response.json(validateScene(scene))
    } catch (error) { next(error) }
  })

  async function searchKnowledgeBase(request, response, next) {
    try {
      const query = String(request.query.query || '').slice(0, 20_000)
      const targetLanguage = String(request.query.targetLanguage || '').slice(0, 20)
      response.json({
        matches: query ? await knowledgeBase.search(query, targetLanguage, 8) : [],
        index: { kind: 'vector', embeddingProvider: 'local-hash-v1' },
      })
    } catch (error) { next(error) }
  }

  async function addKnowledgeBaseEntries(request, response, next) {
    try {
      const values = Array.isArray(request.body?.entries) ? request.body.entries : [request.body]
      const entries = values.map(value => ({
        sourceText: String(value?.sourceText || '').trim().slice(0, 100_000),
        translation: String(value?.translation || '').trim().slice(0, 100_000),
        sourceLanguage: String(value?.sourceLanguage || 'auto').slice(0, 20),
        targetLanguage: String(value?.targetLanguage || 'ru').slice(0, 20),
        clientRef: value?.clientRef ? String(value.clientRef).slice(0, 240) : null,
        provenance: value?.provenance && typeof value.provenance === 'object' ? value.provenance : null,
      }))
      if (!entries.length || entries.some(entry => !entry.sourceText || !entry.translation)) {
        throw httpError(400, 'Для базы знаний нужны исходный текст и перевод')
      }
      const result = await knowledgeBase.addMany(entries)
      response.status(result.created ? 201 : 200).json({ saved: true, ...result })
    } catch (error) { next(error) }
  }

  router.get('/knowledge-base/search', searchKnowledgeBase)
  router.post('/knowledge-base/entries', addKnowledgeBaseEntries)
  // Совместимость со сценами и клиентами предыдущих версий.
  router.get('/translation-memory', searchKnowledgeBase)
  router.post('/translation-memory', addKnowledgeBaseEntries)

  router.post('/documents/:id/translate', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const scene = await readScene(metadata.id)
      const requestedIds = new Set(Array.isArray(request.body?.objectIds) ? request.body.objectIds.map(String) : [])
      const candidates = scene.objects.filter(object => (
        !object.excluded && TRANSLATABLE_TYPES.has(object.type) && (!requestedIds.size || requestedIds.has(object.id))
      ))
      if (!candidates.length) throw httpError(400, 'Нет текстовых сегментов для перевода')
      const translated = []
      const suggested = []
      const pending = []
      for (const object of candidates) {
        const units = ensureTranslationUnits(object)
        for (const unit of units) {
          if (unit.translation.trim()) continue
          const match = await knowledgeBase.findExact(unit.sourceText, scene.targetLanguage)
          if (match) {
            unit.memorySuggestion = {
              entryId: match.id,
              translation: match.translation,
              score: 1,
              matchType: 'exact',
              targetLanguage: scene.targetLanguage,
            }
            unit.status = 'memory-suggested'
            suggested.push({ objectId: object.id, unitId: unit.id, match })
          } else {
            unit.memorySuggestion = null
            pending.push({ id: unit.id, sourceText: unit.sourceText, object, unit })
          }
        }
        syncObjectTranslation(object)
      }
      const codexTranslationStatus = activeAiProvider === 'codex' ? await readCodexStatus() : null
      const machineTranslationReady = activeAiProvider === 'codex'
        ? Boolean(codexTranslationStatus.available && codexTranslationStatus.authenticated)
        : Boolean(provider.apiKey && provider.model)
      if (pending.length && machineTranslationReady) {
        for (const batch of createTranslationBatches(pending)) {
          const result = activeAiProvider === 'codex'
            ? await requestTranslationsWithCodex({
              documentAgent,
              objects: batch,
              scene,
              workdir: documentDirectory(metadata.id),
              runProcess,
            })
            : await requestTranslations(provider, batch, scene)
          const requested = new Set(batch.map(unit => unit.id))
          const byId = new Map()
          for (const item of result) {
            const id = String(item?.id || '')
            if (!requested.has(id)) throw new Error(`Модель вернула неизвестный сегмент ${id}`)
            if (byId.has(id)) throw new Error(`Модель продублировала сегмент ${id}`)
            if (typeof item?.translatedText !== 'string' || !item.translatedText.trim()) throw new Error(`Модель не вернула перевод сегмента ${id}`)
            byId.set(id, item.translatedText)
          }
          for (const item of batch) {
            const value = byId.get(item.id)
            if (!value) throw new Error(`Модель не вернула перевод единицы ${item.id}`)
            item.unit.translation = value
            item.unit.status = 'machine-translated'
            item.unit.memorySuggestion = null
            item.object.translationTextStyles = []
            translated.push({ objectId: item.object.id, unitId: item.unit.id, source: activeAiProvider })
          }
        }
      }
      for (const object of candidates) {
        syncObjectTranslation(object)
        if (object.translation) object.status = 'machine-translated'
        else if (object.translationUnits.some(unit => unit.memorySuggestion?.matchType === 'exact')) object.status = 'memory-suggested'
      }
      scene.updatedAt = new Date().toISOString()
      await writeJson(scenePath(metadata.id), scene)
      response.json({
        scene,
        translated,
        suggested,
        pending: candidates.flatMap(object => object.translationUnits
          .filter(unit => !unit.translation)
          .map(unit => ({ objectId: object.id, unitId: unit.id, hasExactSuggestion: unit.memorySuggestion?.matchType === 'exact' }))),
        provider: activeAiProvider,
        providerConfigured: machineTranslationReady,
        message: pending.length && !machineTranslationReady
          ? 'API перевода не настроен. Точные совпадения из БЗ подготовлены как предложения; остальные единицы доступны для ручного перевода.'
          : suggested.length
            ? `Перевод выполнен. Найдено точных предложений из БЗ: ${suggested.length} — подтвердите их в сегменте.`
            : 'Перевод выполнен. Проверьте формулировки и верстку перед экспортом.',
      })
    } catch (error) { next(error) }
  })

  router.post('/documents/:id/export', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const scene = await readScene(metadata.id)
      const format = String(request.body?.format || 'docx').toLowerCase()
      if (!['docx', 'pdf'].includes(format)) throw httpError(400, 'Доступен экспорт только в DOCX или PDF')
      const exportsDirectory = path.join(documentDirectory(metadata.id), 'exports')
      await fs.promises.mkdir(exportsDirectory, { recursive: true })
      const safeTitle = metadata.title.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'translated-document'
      const outputPath = path.join(exportsDirectory, `${safeTitle}-r${metadata.revision}.${format}`)
      const result = await runProcess(pythonBin, [exporterScript, scenePath(metadata.id), outputPath, format], 120_000)
      if (result.code !== 0) throw httpError(500, result.stderr.trim() || `Не удалось собрать ${format.toUpperCase()}`)
      response.download(outputPath, `${safeTitle}.${format}`)
    } catch (error) { next(error) }
  })

  function documentDirectory(id) {
    if (!DOCUMENT_ID.test(String(id))) throw httpError(404, 'Документ не найден')
    return path.join(dataDir, id)
  }

  function metadataPath(id) { return path.join(documentDirectory(id), 'metadata.json') }
  function scenePath(id) { return path.join(documentDirectory(id), 'scene.json') }

  async function readMetadata(id) {
    try { return JSON.parse(await fs.promises.readFile(metadataPath(id), 'utf8')) }
    catch (error) {
      if (error.status) throw error
      if (error.code === 'ENOENT' || error instanceof SyntaxError) throw httpError(404, 'Документ не найден')
      throw error
    }
  }

  async function readScene(id) {
    try {
      const scene = JSON.parse(await fs.promises.readFile(scenePath(id), 'utf8'))
      for (const object of scene.objects || []) ensureTranslationUnits(object)
      return scene
    }
    catch (error) {
      if (error.status) throw error
      if (error.code === 'ENOENT' || error instanceof SyntaxError) throw httpError(404, 'Документ не найден')
      throw error
    }
  }

  async function writeJson(target, value) {
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    const temporary = `${target}.${process.pid}.writing`
    await fs.promises.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8')
    await fs.promises.rename(temporary, target)
  }

  return router
}

async function requestTranslations(provider, objects, scene) {
  const response = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      reasoning: { effort: 'minimal', exclude: true },
      messages: [
        {
          role: 'system',
          content: 'Вы профессиональный переводчик бюро переводов. Сохраняйте юридический смысл, имена, числа и структуру. Верните только JSON-массив объектов {"id":"...","translatedText":"..."}; все переданные id должны присутствовать ровно один раз.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            sourceLanguage: scene.sourceLanguage,
            targetLanguage: scene.targetLanguage,
            segments: objects.map(object => ({ id: object.id, text: object.sourceText })),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw httpError(502, `Провайдер перевода вернул HTTP ${response.status}`)
  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const parsed = parseJsonArray(content)
  if (!Array.isArray(parsed)) throw new Error('Модель вернула ответ не в виде массива')
  return parsed
}

async function requestTranslationsWithCodex(options) {
  const { documentAgent, objects, scene, workdir, runProcess } = options
  const suffix = crypto.randomBytes(8).toString('hex')
  const schemaPath = path.join(workdir, `.translation-${suffix}.schema.json`)
  const outputPath = path.join(workdir, `.translation-${suffix}.json`)
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['translations'],
    properties: {
      translations: {
        type: 'array',
        minItems: objects.length,
        maxItems: objects.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'translatedText'],
          properties: {
            id: { type: 'string' },
            translatedText: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  }
  const prompt = [
    'Вы профессиональный переводчик бюро переводов.',
    `Переведите каждый сегмент с языка ${scene.sourceLanguage || 'auto'} на ${scene.targetLanguage || 'ru'}.`,
    'Сохраняйте юридический смысл, имена, числа, разрывы строк и структуру.',
    'Не объединяйте и не пропускайте сегменты. Верните каждый id ровно один раз по заданной JSON Schema.',
    JSON.stringify({ segments: objects.map(object => ({ id: object.id, text: object.sourceText })) }),
  ].join(' ')
  await fs.promises.writeFile(schemaPath, JSON.stringify(schema), 'utf8')
  try {
    const args = [
      'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules',
      '--model', documentAgent.model,
      '--sandbox', 'read-only', '--color', 'never', '--cd', workdir,
      '--output-schema', schemaPath,
      '--output-last-message', outputPath,
      prompt,
    ]
    const result = await runProcess(documentAgent.codexBin, args, Math.min(documentAgent.timeoutMs, 300_000))
    if (result.code !== 0) {
      const detail = String(result.stderr || result.stdout || '').trim().split('\n').slice(-8).join('\n')
      throw httpError(502, detail || `Codex завершился с кодом ${result.code}`)
    }
    const parsed = JSON.parse(await fs.promises.readFile(outputPath, 'utf8'))
    if (!Array.isArray(parsed?.translations)) throw new Error('Codex вернул некорректный результат перевода')
    return parsed.translations
  } finally {
    await Promise.all([
      fs.promises.rm(schemaPath, { force: true }),
      fs.promises.rm(outputPath, { force: true }),
    ])
  }
}

function createTranslationBatches(objects, maximumObjects = 20, maximumCharacters = 50_000) {
  const batches = []
  let current = []
  let characters = 0
  for (const object of objects) {
    const length = String(object.sourceText || '').length
    if (current.length && (current.length >= maximumObjects || characters + length > maximumCharacters)) {
      batches.push(current)
      current = []
      characters = 0
    }
    current.push(object)
    characters += length
  }
  if (current.length) batches.push(current)
  return batches
}

function autoLayout(scene, selectedIds) {
  const selected = selectedIds?.length ? new Set(selectedIds) : null
  for (const page of scene.pages) {
    const objects = scene.objects
      .filter(object => object.pageIndex === page.index && !object.excluded && (!selected || selected.has(object.id)))
      .sort((left, right) => left.y - right.y || left.x - right.x)
    const placed = []
    for (const object of objects) {
      const text = String(object.translation || object.sourceText || '')
      const font = finite(object.style?.fontSizePx, 14, 6, 96)
      const lineHeight = font * finite(object.style?.lineHeight, 1.2, 0.8, 3)
      const capacity = Math.max(1, object.width / (font * 0.52))
      const lines = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / capacity)), 0)
      object.height = Math.max(object.height, lines * lineHeight + 8)
      let changed = true
      while (changed) {
        changed = false
        for (const previous of placed) {
          const horizontal = object.x < previous.x + previous.width && object.x + object.width > previous.x
          const vertical = object.y < previous.y + previous.height && object.y + object.height > previous.y
          if (horizontal && vertical) {
            object.y = previous.y + previous.height + 8
            changed = true
          }
        }
      }
      object.y = Math.min(Math.max(0, object.y), Math.max(0, page.heightPx - object.height))
      placed.push(object)
    }
  }
}

function buildAgentSummary(scene, report) {
  const types = {}
  for (const object of scene.objects) types[object.type] = (types[object.type] || 0) + 1
  return {
    pages: scene.pages.length,
    objects: scene.objects.length,
    types,
    lowConfidence: report.warnings.filter(item => item.code === 'low-confidence').length,
    requiresTranslation: report.warnings.filter(item => item.code === 'missing-translation').length,
  }
}

function serializeDocument(metadata, scene) {
  return {
    metadata,
    scene,
    qaUrl: `/api/studio/documents/${metadata.id}/qa`,
    exportUrl: `/api/studio/documents/${metadata.id}/export`,
  }
}

module.exports = {
  createTranslationBatches,
  createStudioRouter,
  normalizeScene,
  parseJsonArray,
}
