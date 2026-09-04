const express = require('express')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { buildOcrReview, buildScene, findMemoryMatches, validateScene } = require('./studio-model.cjs')

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
    ocrStats: {
      primaryLines: Math.trunc(finite(page.ocrStats?.primaryLines, 0, 0, MAX_OBJECTS)),
      secondaryLines: Math.trunc(finite(page.ocrStats?.secondaryLines, 0, 0, MAX_OBJECTS)),
      mergedLines: Math.trunc(finite(page.ocrStats?.mergedLines, 0, 0, MAX_OBJECTS)),
      nativeLines: Math.trunc(finite(page.ocrStats?.nativeLines, 0, 0, MAX_OBJECTS)),
      tiledLines: Math.trunc(finite(page.ocrStats?.tiledLines, 0, 0, MAX_OBJECTS)),
      agentAddedLines: Math.trunc(finite(page.ocrStats?.agentAddedLines, 0, 0, MAX_OBJECTS)),
      agentCorrectedLines: Math.trunc(finite(page.ocrStats?.agentCorrectedLines, 0, 0, MAX_OBJECTS)),
      agentRemovedLines: Math.trunc(finite(page.ocrStats?.agentRemovedLines, 0, 0, MAX_OBJECTS)),
    },
  }))
  const seen = new Set()
  const objects = scene.objects.map((object, index) => {
    const id = String(object?.id || `object-${index + 1}`).slice(0, 120)
    if (seen.has(id)) throw httpError(400, `Повторяющийся ID сегмента: ${id}`)
    seen.add(id)
    const pageIndex = Math.trunc(finite(object.pageIndex, 0, 0, pages.length - 1))
    const page = pages[pageIndex]
    const type = ['text', 'stamp', 'seal', 'signature', 'logo', 'image', 'unknown'].includes(object.type)
      ? object.type
      : 'text'
    const sourceText = String(object.sourceText || '').slice(0, 100_000)
    const translation = String(object.translation || '').slice(0, 100_000)
    return {
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
      ocrAlternatives: Array.isArray(object.ocrAlternatives)
        ? object.ocrAlternatives.map(value => String(value).slice(0, 10_000)).filter(Boolean).slice(0, 12)
        : [],
      sourceTextStyles: normalizeTextStyles(object.sourceTextStyles, sourceText),
      translationTextStyles: normalizeTextStyles(object.translationTextStyles, translation),
      originalBounds: {
        x: finite(object.originalBounds?.x, object.x, -page.widthPx, page.widthPx * 2),
        y: finite(object.originalBounds?.y, object.y, -page.heightPx, page.heightPx * 2),
        width: finite(object.originalBounds?.width, object.width, 12, page.widthPx * 2),
        height: finite(object.originalBounds?.height, object.height, 12, page.heightPx * 2),
      },
    }
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
  const memoryPath = path.join(dataDir, 'translation-memory.json')
  fs.mkdirSync(dataDir, { recursive: true })

  const provider = {
    apiUrl: process.env.TRANSLATION_API_URL || process.env.AI_API_URL || 'https://api.aitunnel.ru/v1/chat/completions',
    apiKey: process.env.TRANSLATION_API_KEY || process.env.AI_API_KEY || '',
    model: process.env.TRANSLATION_MODEL || process.env.AI_MODEL || '',
    visionEnabled: String(process.env.DOCUMENT_VISION_ENABLED || '').toLowerCase() === 'true',
    visionModel: process.env.DOCUMENT_VISION_MODEL || process.env.TRANSLATION_MODEL || process.env.AI_MODEL || '',
    visionAutoAugment: String(process.env.DOCUMENT_VISION_AUTO_AUGMENT || 'true').toLowerCase() !== 'false',
    visionMinimumConfidence: finite(process.env.DOCUMENT_VISION_MIN_CONFIDENCE, 0.86, 0.5, 1),
  }

  router.get('/status', (request, response) => {
    response.json({
      platform: process.platform,
      localAnalyzerAvailable: fs.existsSync(analyzerScript),
      localAnalyzer: 'RapidOCR/ONNX + PyMuPDF',
      translationProviderConfigured: Boolean(provider.apiKey && provider.model),
      translationModel: provider.model || null,
      documentVisionEnabled: Boolean(provider.apiKey && provider.visionModel && provider.visionEnabled),
      documentVisionAutoAugment: Boolean(provider.apiKey && provider.visionModel && provider.visionEnabled && provider.visionAutoAugment),
      supportedInputs: [...ACCEPTED_EXTENSIONS],
      supportedExports: ['docx', 'pdf'],
    })
  })

  router.post(
    '/documents',
    express.raw({ type: 'application/octet-stream', limit: '80mb' }),
    async (request, response, next) => {
      try {
        if (!Buffer.isBuffer(request.body) || request.body.length < 16) throw httpError(400, 'Файл пуст или повреждён')
        const filename = safeFilename(request.get('X-File-Name'))
        const extension = path.extname(filename).toLowerCase()
        if (!ACCEPTED_EXTENSIONS.has(extension)) throw httpError(400, 'Поддерживаются PDF и растровые изображения')
        const id = crypto.randomBytes(16).toString('hex')
        const directory = documentDirectory(id)
        const pagesDirectory = path.join(directory, 'pages')
        await fs.promises.mkdir(pagesDirectory, { recursive: true })
        const sourcePath = path.join(directory, `source${extension}`)
        await fs.promises.writeFile(sourcePath, request.body)
        const analysisPath = path.join(directory, 'analysis.json')
        const result = await runProcess(pythonBin, [analyzerScript, sourcePath, pagesDirectory, analysisPath], 900_000)
        if (result.code !== 0) throw httpError(500, result.stderr.trim() || 'Не удалось распознать документ')
        const analysis = JSON.parse(await fs.promises.readFile(analysisPath, 'utf8'))
        if (!analysis.pages?.length) throw httpError(422, 'В документе не найдено страниц')
        let visionAugmentation = null
        let visionError = null
        if (provider.apiKey && provider.visionModel && provider.visionEnabled && provider.visionAutoAugment) {
          try {
            visionAugmentation = await requestVisionAugmentation(provider, analysis, pagesDirectory)
            await writeJson(analysisPath, analysis)
          } catch (error) {
            visionError = error.message
          }
        }
        const scene = buildScene(analysis, {
          documentId: id,
          title: path.basename(filename, extension),
          fitRasterToA4: extension !== '.pdf',
        })
        const now = new Date().toISOString()
        const metadata = {
          id,
          filename,
          extension,
          title: scene.title,
          createdAt: now,
          updatedAt: now,
          revision: 1,
          pageCount: scene.pages.length,
          objectCount: scene.objects.length,
          analyzer: analysis.engine,
          visionAugmentation,
          visionError,
        }
        await Promise.all([writeJson(metadataPath(id), metadata), writeJson(scenePath(id), scene)])
        response.status(201).json(serializeDocument(metadata, scene))
      } catch (error) {
        next(error)
      }
    }
  )

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

  router.post('/documents/:id/agent/review-ocr', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const scene = await readScene(metadata.id)
      const requestedIds = new Set(Array.isArray(request.body?.objectIds) ? request.body.objectIds.map(String) : [])
      const objects = scene.objects.filter(object => (
        !object.excluded && object.type === 'text' && (!requestedIds.size || requestedIds.has(object.id))
      ))
      let agentSuggestions = []
      let providerError = null
      const reviewModel = provider.visionEnabled ? provider.visionModel : provider.model
      if (objects.length && provider.apiKey && reviewModel) {
        try {
          for (const batch of createTranslationBatches(objects, 35, 35_000)) {
            agentSuggestions.push(...await requestOcrReview(provider, batch, scene, path.join(documentDirectory(metadata.id), 'pages')))
          }
        } catch (error) {
          providerError = error.message
        }
      }
      const report = buildOcrReview(scene, agentSuggestions)
      response.json({
        ...report,
        providerConfigured: Boolean(provider.apiKey && reviewModel),
        providerError,
        message: providerError
          ? `Агент недоступен: ${providerError}. Показаны результаты локальной проверки.`
          : agentSuggestions.length
            ? 'Локальная проверка и агент завершили анализ OCR.'
            : 'Показаны результаты локальной проверки. Для смысловой проверки настройте API агента.',
      })
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

  router.get('/translation-memory', async (request, response, next) => {
    try {
      const entries = await readMemory()
      const query = String(request.query.query || '').slice(0, 20_000)
      response.json({ matches: query ? findMemoryMatches(entries, query, String(request.query.targetLanguage || ''), 8) : [] })
    } catch (error) { next(error) }
  })

  router.post('/translation-memory', async (request, response, next) => {
    try {
      const sourceText = String(request.body?.sourceText || '').trim().slice(0, 100_000)
      const translation = String(request.body?.translation || '').trim().slice(0, 100_000)
      if (!sourceText || !translation) throw httpError(400, 'Для базы переводов нужны исходный текст и перевод')
      const entries = await readMemory()
      const now = new Date().toISOString()
      const existing = entries.find(entry => entry.sourceText === sourceText && entry.targetLanguage === request.body?.targetLanguage)
      if (existing) {
        existing.translation = translation
        existing.updatedAt = now
      } else {
        entries.push({
          id: crypto.randomBytes(10).toString('hex'),
          sourceText,
          translation,
          sourceLanguage: String(request.body?.sourceLanguage || 'auto').slice(0, 20),
          targetLanguage: String(request.body?.targetLanguage || 'ru').slice(0, 20),
          createdAt: now,
          updatedAt: now,
        })
      }
      await writeJson(memoryPath, entries.slice(-20_000))
      response.status(201).json({ saved: true })
    } catch (error) { next(error) }
  })

  router.post('/documents/:id/translate', async (request, response, next) => {
    try {
      const metadata = await readMetadata(request.params.id)
      const scene = await readScene(metadata.id)
      const requestedIds = new Set(Array.isArray(request.body?.objectIds) ? request.body.objectIds.map(String) : [])
      const candidates = scene.objects.filter(object => (
        !object.excluded && object.type === 'text' && (!requestedIds.size || requestedIds.has(object.id))
      )).slice(0, 100)
      if (!candidates.length) throw httpError(400, 'Нет текстовых сегментов для перевода')
      const memory = await readMemory()
      const translated = []
      const pending = []
      for (const object of candidates) {
        const match = findMemoryMatches(memory, object.sourceText, scene.targetLanguage, 1)[0]
        if (match?.score === 1) {
          object.translation = match.translation
          object.translationTextStyles = []
          object.status = 'tm-exact'
          translated.push({ id: object.id, source: 'memory' })
        } else {
          pending.push(object)
        }
      }
      if (pending.length && provider.apiKey && provider.model) {
        for (const batch of createTranslationBatches(pending)) {
          const result = await requestTranslations(provider, batch, scene)
          const requested = new Set(batch.map(object => object.id))
          const byId = new Map()
          for (const item of result) {
            const id = String(item?.id || '')
            if (!requested.has(id)) throw new Error(`Модель вернула неизвестный сегмент ${id}`)
            if (byId.has(id)) throw new Error(`Модель продублировала сегмент ${id}`)
            if (typeof item?.translatedText !== 'string' || !item.translatedText.trim()) throw new Error(`Модель не вернула перевод сегмента ${id}`)
            byId.set(id, item.translatedText)
          }
          for (const object of batch) {
            const value = byId.get(object.id)
            if (!value) throw new Error(`Модель не вернула перевод сегмента ${object.id}`)
            object.translation = value
            object.translationTextStyles = []
            object.status = 'machine-translated'
            translated.push({ id: object.id, source: 'provider' })
          }
        }
      }
      scene.updatedAt = new Date().toISOString()
      await writeJson(scenePath(metadata.id), scene)
      response.json({
        scene,
        translated,
        pending: pending.filter(object => !object.translation).map(object => object.id),
        providerConfigured: Boolean(provider.apiKey && provider.model),
        message: pending.length && !(provider.apiKey && provider.model)
          ? 'API перевода не настроен. Совпадения из локальной базы применены; остальные сегменты доступны для ручного перевода.'
          : 'Перевод применён. Проверьте формулировки и верстку перед экспортом.',
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
    try { return JSON.parse(await fs.promises.readFile(scenePath(id), 'utf8')) }
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

  async function readMemory() {
    try {
      const value = JSON.parse(await fs.promises.readFile(memoryPath, 'utf8'))
      return Array.isArray(value) ? value : []
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return []
      throw error
    }
  }

  return router
}

function lineOverlapRatio(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x))
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y))
  const smaller = Math.min(left.width * left.height, right.width * right.height)
  return smaller > 0 ? width * height / smaller : 0
}

function lineAreaSimilarity(left, right) {
  const smaller = Math.min(left.width * left.height, right.width * right.height)
  const larger = Math.max(left.width * left.height, right.width * right.height)
  return larger > 0 ? smaller / larger : 0
}

function normalizeAgentText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizedAgentBounds(rawBounds, page) {
  const values = Array.isArray(rawBounds) ? rawBounds.map(Number) : []
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) return null
  const [x, y, width, height] = values
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.01 || y + height > 1.01) return null
  return { x: x * page.width, y: y * page.height, width: width * page.width, height: height * page.height }
}

function applyVisionAugmentation(analysis, pageIndex, suggestions, minimumConfidence = 0.86) {
  const page = analysis.pages?.[pageIndex]
  if (!page || !Array.isArray(page.lines)) return { added: 0, corrected: 0, removed: 0, rejected: 0 }
  const result = { added: 0, corrected: 0, removed: 0, rejected: 0 }
  const removedIndexes = new Set()
  for (const raw of Array.isArray(suggestions) ? suggestions : []) {
    const action = String(raw?.action || raw?.kind || '').toLowerCase()
    const confidence = finite(raw?.confidence, 0, 0, 1)
    const text = normalizeAgentText(raw?.text || raw?.suggestedText)
    if (confidence < minimumConfidence) {
      result.rejected += 1
      continue
    }
    if (action === 'remove' || action === 'suppress') {
      const lineIndex = Math.trunc(Number(raw.lineIndex))
      const line = page.lines[lineIndex]
      const original = normalizeAgentText(raw.originalText)
      // Removal is deliberately stricter than correction/addition and remains
      // recoverable in page.visionDiscardedLines for later diagnostics.
      if (!line || !original || confidence < Math.max(0.93, minimumConfidence) || normalizeAgentText(line.text) !== original) {
        result.rejected += 1
        continue
      }
      removedIndexes.add(lineIndex)
      continue
    }
    if (!text) {
      result.rejected += 1
      continue
    }
    if (action === 'replace' || action === 'correction') {
      const lineIndex = Math.trunc(Number(raw.lineIndex))
      const line = page.lines[lineIndex]
      const original = normalizeAgentText(raw.originalText)
      if (!line || !original || normalizeAgentText(line.text) !== original) {
        result.rejected += 1
        continue
      }
      const alternatives = [line.text, ...(line.alternatives || [])]
        .map(normalizeAgentText)
        .filter((value, index, values) => value && value !== text && values.indexOf(value) === index)
      line.text = text
      line.alternatives = alternatives.slice(0, 8)
      line.confidence = Math.max(Number(line.confidence || 0), Math.min(0.94, confidence))
      line.source = 'vision-agent-corrected'
      const correctedBounds = raw.bbox == null ? null : normalizedAgentBounds(raw.bbox, page)
      if (correctedBounds) Object.assign(line, correctedBounds)
      if (['text', 'stamp', 'seal', 'signature', 'logo'].includes(raw.type)) line.type = raw.type
      result.corrected += 1
      continue
    }
    if (action !== 'add' && action !== 'missing-text') {
      result.rejected += 1
      continue
    }
    const bounds = normalizedAgentBounds(raw.bbox, page)
    if (!bounds) {
      result.rejected += 1
      continue
    }
    const candidate = {
      text,
      confidence: Math.min(0.9, confidence),
      alternatives: [],
      ...bounds,
      source: 'vision-agent-added',
      type: ['text', 'stamp', 'seal', 'signature', 'logo'].includes(raw.type) ? raw.type : 'text',
    }
    const duplicate = page.lines.find(line => (
      (lineOverlapRatio(line, candidate) >= 0.72 && lineAreaSimilarity(line, candidate) >= 0.42)
      || (lineOverlapRatio(line, candidate) >= 0.42 && normalizeAgentText(line.text).toLowerCase() === text.toLowerCase())
    ))
    if (duplicate) {
      if (normalizeAgentText(duplicate.text).toLowerCase() !== text.toLowerCase()) {
        duplicate.alternatives = [...new Set([...(duplicate.alternatives || []), text])].slice(0, 8)
      }
      result.rejected += 1
      continue
    }
    page.lines.push(candidate)
    result.added += 1
  }
  if (removedIndexes.size) {
    const discarded = []
    page.lines = page.lines.filter((line, index) => {
      if (!removedIndexes.has(index)) return true
      discarded.push({ ...line, reason: 'vision-agent-redundant' })
      return false
    })
    page.visionDiscardedLines = [...(page.visionDiscardedLines || []), ...discarded].slice(-500)
    result.removed = discarded.length
  }
  page.lines.sort((left, right) => left.y - right.y || left.x - right.x)
  page.agentAddedLineCount = Number(page.agentAddedLineCount || 0) + result.added
  page.agentCorrectedLineCount = Number(page.agentCorrectedLineCount || 0) + result.corrected
  page.agentRemovedLineCount = Number(page.agentRemovedLineCount || 0) + result.removed
  return result
}

async function requestVisionAugmentation(provider, analysis, pagesDirectory) {
  const total = { pages: analysis.pages.length, checkedPages: 0, added: 0, corrected: 0, removed: 0, rejected: 0, errors: [] }
  for (const page of analysis.pages) {
    const lines = (page.lines || []).map((line, lineIndex) => ({
      lineIndex,
      text: line.text,
      confidence: line.confidence,
      source: line.source,
      bbox: [line.x / page.width, line.y / page.height, line.width / page.width, line.height / page.height]
        .map(value => Number(value.toFixed(6))),
    }))
    const imageData = await fs.promises.readFile(path.join(pagesDirectory, page.image || `page-${String(page.index + 1).padStart(3, '0')}.png`))
    try {
      const response = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: provider.visionModel,
          temperature: 0,
          max_tokens: 16_000,
          messages: [{
            role: 'system',
            content: [
              'Вы выполняете посимвольный контроль OCR для бюро переводов. Не переводите, не пересказывайте и не дополняйте исходник.',
              'Сравните изображение со списком распознанных строк. Найдите весь отсутствующий видимый текст и только уверенные ошибки OCR.',
              'Координаты bbox нормализованы относительно страницы: [x,y,width,height], значения от 0 до 1.',
              'Верните только JSON-массив. Для пропуска: {"action":"add","text":"точный текст","bbox":[x,y,w,h],"type":"text|stamp|seal|signature|logo","confidence":0..1,"reason":"..."}.',
              'Для исправления: {"action":"replace","lineIndex":0,"originalText":"точное текущее значение","text":"исправленное значение","bbox":[x,y,w,h],"type":"text","confidence":0..1,"reason":"..."}. bbox можно опустить, если геометрия верна.',
              'Ложный или дублирующий фрагмент OCR можно удалить только при полной уверенности: {"action":"remove","lineIndex":0,"originalText":"точное текущее значение","confidence":0..1,"reason":"duplicate|artifact"}.',
              'Видимую подпись, печать, штамп или логотип без читаемого текста добавляйте отдельным объектом с точным bbox и текстом-маркером /Подпись/, /Круглая печать/, /Штамп/ или /Логотип/.',
              'Не объединяйте разные строки, не угадывайте нечитаемые символы и не удаляйте сомнительный текст.',
            ].join(' '),
          }, {
            role: 'user',
            content: [{
              type: 'text',
              text: JSON.stringify({ pageIndex: page.index, width: page.width, height: page.height, lines }),
            }, {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageData.toString('base64')}`, detail: 'high' },
            }],
          }],
        }),
        signal: AbortSignal.timeout(180_000),
      })
      if (!response.ok) throw httpError(502, `HTTP ${response.status}`)
      const payload = await response.json()
      const suggestions = parseJsonArray(payload?.choices?.[0]?.message?.content)
      const pageResult = applyVisionAugmentation(analysis, page.index, suggestions, provider.visionMinimumConfidence)
      total.checkedPages += 1
      total.added += pageResult.added
      total.corrected += pageResult.corrected
      total.removed += pageResult.removed
      total.rejected += pageResult.rejected
    } catch (error) {
      total.errors.push({ pageIndex: page.index, message: String(error?.message || error).slice(0, 300) })
    }
  }
  return total
}

async function requestOcrReview(provider, objects, scene, pagesDirectory) {
  const ordered = [...scene.objects]
    .filter(object => !object.excluded && object.type === 'text')
    .sort((left, right) => left.pageIndex - right.pageIndex || left.readingOrder - right.readingOrder)
  const orderById = new Map(ordered.map((object, index) => [object.id, index]))
  const reviewPayload = {
    sourceLanguage: scene.sourceLanguage,
    segments: objects.map(object => {
      const index = orderById.get(object.id)
      return {
        objectId: object.id,
        pageIndex: object.pageIndex,
        text: object.sourceText,
        confidence: object.confidence,
        ocrAlternatives: object.ocrAlternatives || [],
        previousText: index > 0 ? ordered[index - 1].sourceText : '',
        nextText: index < ordered.length - 1 ? ordered[index + 1].sourceText : '',
      }
    }),
  }
  let userContent = JSON.stringify(reviewPayload)
  if (provider.visionEnabled) {
    const pageIndexes = [...new Set(objects.map(object => object.pageIndex))].slice(0, 4)
    const content = [{
      type: 'text',
      text: `${JSON.stringify(reviewPayload)}\nНиже приложены оригиналы страниц в порядке: ${pageIndexes.map(index => index + 1).join(', ')}. Сверьте все сегменты с изображениями и сообщите также о видимом тексте, которого нет среди сегментов.`,
    }]
    for (const pageIndex of pageIndexes) {
      const imageData = await fs.promises.readFile(path.join(pagesDirectory, `page-${String(pageIndex + 1).padStart(3, '0')}.png`))
      content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imageData.toString('base64')}`, detail: 'high' } })
    }
    userContent = content
  }
  const response = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.visionEnabled ? provider.visionModel : provider.model,
      messages: [
        {
          role: 'system',
          content: [
            'Вы редактор OCR в бюро переводов. Проверяйте распознанный исходный текст, не переводите его.',
            'Ищите неверно распознанные слова, склейки/разрывы слов, смешение алфавитов и фразы, нарушающие смысл контекста.',
            'Не меняйте корректные имена, номера, даты и юридические формулировки. Предлагайте правку только при наличии основания.',
            'Верните только JSON-массив объектов {"objectId":"... или null","pageIndex":0,"originalText":"...","suggestedText":"...","confidence":0..1,"kind":"spelling|joined-words|semantic|ocr-artifact|missing-text","reason":"..."}.',
            'Для исправления существующего сегмента originalText должен полностью совпадать с переданным текстом. Для пропущенного на изображении текста используйте objectId:null, kind:"missing-text" и нумерацию pageIndex с нуля. Если правок нет, верните [].',
          ].join(' '),
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw httpError(502, `Провайдер агента вернул HTTP ${response.status}`)
  const payload = await response.json()
  const parsed = parseJsonArray(payload?.choices?.[0]?.message?.content)
  if (!Array.isArray(parsed)) throw new Error('Агент вернул ответ не в виде массива')
  const byId = new Map(objects.map(object => [object.id, object]))
  return parsed.filter(item => {
    const objectId = String(item?.objectId || '')
    if (!objectId) return item?.kind === 'missing-text' && Number.isInteger(Number(item.pageIndex))
    const object = byId.get(objectId)
    return object && String(item.originalText || '').trim() === String(object.sourceText || '').trim()
  }).map(item => ({
    objectId: item.objectId ? String(item.objectId) : null,
    pageIndex: Number(item.pageIndex || 0),
    originalText: String(item.originalText || ''),
    suggestedText: String(item.suggestedText || ''),
    confidence: finite(item.confidence, 0.5, 0, 1),
    kind: String(item.kind || 'semantic'),
    reason: String(item.reason || 'Агент рекомендует сверить текст с оригиналом'),
  }))
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
  applyVisionAugmentation,
  createTranslationBatches,
  createStudioRouter,
  normalizeScene,
  parseJsonArray,
}
