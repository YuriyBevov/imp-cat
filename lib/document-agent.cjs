const fs = require('node:fs')
const path = require('node:path')

const AGENT_TYPES = new Set([
  'text',
  'table',
  'table_cell',
  'stamp',
  'seal',
  'signature',
  'handwriting',
  'logo',
  'image',
  'unknown',
])

const PAGE_LIMIT = 400
const SEGMENT_LIMIT = 12_000

function finite(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

function normalizeRegion(region) {
  const x = finite(region?.x, 0, 0, 1)
  const y = finite(region?.y, 0, 0, 1)
  const width = finite(region?.width, 0, 0, 1 - x)
  const height = finite(region?.height, 0, 0, 1 - y)
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function normalizeStyle(style) {
  return {
    fontFamily: String(style?.fontFamily || 'Arial').slice(0, 120),
    fontSizePt: finite(style?.fontSizePt, 10.5, 4, 96),
    fontWeight: Math.round(finite(style?.fontWeight, 400, 100, 900) / 100) * 100,
    fontStyle: style?.fontStyle === 'italic' ? 'italic' : 'normal',
    textAlign: ['left', 'center', 'right', 'justify'].includes(style?.textAlign) ? style.textAlign : 'left',
    lineHeight: finite(style?.lineHeight, 1.2, 0.8, 3),
    color: /^#[0-9a-f]{6}$/i.test(style?.color) ? style.color.toUpperCase() : '#111827',
  }
}

function uniqueSegmentId(rawId, pageIndex, readingOrder, usedIds) {
  const base = String(rawId || `segment-${pageIndex + 1}-${readingOrder + 1}`)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || `segment-${pageIndex + 1}-${readingOrder + 1}`
  let candidate = base
  let suffix = 2
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`.slice(0, 120)
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function normalizeCodexAnalysis(raw, manifest) {
  if (!raw || !Array.isArray(raw.pages)) throw new Error('Codex не вернул массив страниц')
  const manifestPages = Array.isArray(manifest?.pages) ? manifest.pages : []
  if (!manifestPages.length || manifestPages.length > PAGE_LIMIT) throw new Error('Некорректный манифест страниц')
  if (raw.pages.length !== manifestPages.length) {
    throw new Error(`Codex вернул ${raw.pages.length} стр. вместо ${manifestPages.length}`)
  }

  const rawIndexes = raw.pages.map(page => Number(page?.pageIndex))
  const usesOneBasedIndexes = rawIndexes.length === manifestPages.length
    && rawIndexes.every(index => Number.isInteger(index) && index >= 1 && index <= manifestPages.length)
    && new Set(rawIndexes).size === manifestPages.length
  const pagesByIndex = new Map()
  for (const page of raw.pages) {
    const reportedIndex = Number(page?.pageIndex)
    const pageIndex = usesOneBasedIndexes ? reportedIndex - 1 : reportedIndex
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= manifestPages.length || pagesByIndex.has(pageIndex)) {
      throw new Error(`Некорректный или повторяющийся pageIndex: ${page?.pageIndex}`)
    }
    pagesByIndex.set(pageIndex, page)
  }

  const usedIds = new Set()
  let segmentCount = 0
  const pages = manifestPages.map((manifestPage, pageIndex) => {
    const rawPage = pagesByIndex.get(pageIndex)
    if (!rawPage) throw new Error(`Codex пропустил страницу ${pageIndex + 1}`)
    if (!Array.isArray(rawPage.segments)) throw new Error(`На странице ${pageIndex + 1} отсутствует массив segments`)
    const segments = rawPage.segments.map((segment, index) => {
      segmentCount += 1
      if (segmentCount > SEGMENT_LIMIT) throw new Error(`Codex вернул больше ${SEGMENT_LIMIT} сегментов`)
      const type = AGENT_TYPES.has(segment?.type) ? segment.type : 'unknown'
      const sourceText = String(segment?.sourceText || '').replace(/\r\n?/g, '\n').trim().slice(0, 100_000)
      const regions = (Array.isArray(segment?.regions) ? segment.regions : [])
        .map(normalizeRegion)
        .filter(Boolean)
      if (!regions.length) throw new Error(`У сегмента ${segment?.segmentId || index + 1} нет корректных координат`)
      if (type === 'text' && !sourceText) throw new Error(`Пустой текстовый сегмент на странице ${pageIndex + 1}`)
      const readingOrder = Math.trunc(finite(segment?.readingOrder, index, 0, SEGMENT_LIMIT))
      return {
        segmentId: uniqueSegmentId(segment?.segmentId, pageIndex, readingOrder, usedIds),
        type,
        sourceText,
        readingOrder,
        flowGroup: String(segment?.flowGroup || `page-${pageIndex + 1}-body`).slice(0, 120),
        regions,
        style: normalizeStyle(segment?.style),
        confidence: finite(segment?.confidence, 0.5, 0, 1),
        needsReview: Boolean(segment?.needsReview),
        notes: String(segment?.notes || '').slice(0, 1000),
      }
    }).sort((left, right) => left.readingOrder - right.readingOrder)
    return {
      index: pageIndex,
      width: finite(manifestPage.width, 1, 1, 100_000),
      height: finite(manifestPage.height, 1, 1, 100_000),
      image: path.basename(String(manifestPage.image || `page-${String(pageIndex + 1).padStart(3, '0')}.png`)),
      languages: Array.isArray(rawPage.languages) ? rawPage.languages.map(String).filter(Boolean).slice(0, 20) : [],
      segments,
    }
  })

  return {
    engine: 'Codex Document Agent',
    documentTitle: String(raw.documentTitle || '').slice(0, 500),
    languages: Array.isArray(raw.languages) ? raw.languages.map(String).filter(Boolean).slice(0, 20) : [],
    pages,
  }
}

function buildDocumentPrompt(filename, manifest) {
  const pageDescription = manifest.pages.map(page => (
    `страница ${page.index + 1}: ${page.image}, ${page.width}×${page.height} px`
  )).join('; ')
  return [
    `Проанализируй документ «${filename}» для профессионального бюро переводов.`,
    `К запросу приложены страницы строго по порядку: ${pageDescription}.`,
    'В JSON поле pageIndex нумеруется с нуля: первая страница имеет pageIndex=0, вторая pageIndex=1.',
    'Не переводи документ. Выполни точную транскрипцию всего видимого читаемого текста и верни результат только по заданной JSON Schema.',
    'Самостоятельно проверь каждую страницу перед ответом: нельзя пропускать короткие строки, номера, даты, колонтитулы, подписи к таблицам, текст в печатях и штампах.',
    'Разделяй документ на логические редактируемые сегменты. Не объединяй независимые колонки, таблицу с обычным абзацем или подпись с соседним текстом.',
    'Для таблиц сохраняй структуру: используй table_cell для отдельных визуальных ячеек либо table для единого объекта, если разделение невозможно.',
    'Обнаруживай stamp, seal, signature, handwriting, logo и image. Для stamp/seal/signature/handwriting запиши в sourceText весь уверенно читаемый текст; если он не читается, оставь sourceText пустым и объясни это в notes. Не угадывай символы.',
    'Каждому объекту дай regions с нормализованными координатами x,y,width,height от 0 до 1 относительно приложенной страницы. Несколько раздельных областей одного логического сегмента перечисляй отдельно.',
    'readingOrder задавай в естественном порядке чтения внутри страницы. flowGroup используй для независимых областей вроде page-1-header, page-1-body, page-1-table-1, page-1-signatures и page-1-footer.',
    'Оцени исходную типографику: семейство и размер шрифта, жирность, курсив, выравнивание, межстрочный интервал и цвет. Не приписывай текст, которого нет на изображении.',
    'needsReview=true ставь для неуверенной транскрипции, сомнительного порядка или неоднозначной классификации. В notes кратко укажи причину на русском языке.',
  ].join(' ')
}

function buildCodexArguments(options) {
  const args = [
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--model', options.model,
    '--sandbox', 'read-only',
    '--color', 'never',
    '--cd', options.workdir,
  ]
  for (const imagePath of options.imagePaths) args.push('--image', imagePath)
  args.push('--output-schema', options.schemaPath)
  args.push('--output-last-message', options.outputPath)
  args.push(options.prompt)
  return args
}

async function analyzeDocumentWithCodex(options) {
  const {
    codexBin = 'codex',
    model = 'gpt-5.6-sol',
    workdir,
    documentDirectory,
    filename,
    manifest,
    schemaPath,
    outputPath = path.join(documentDirectory, 'codex-analysis.json'),
    timeoutMs = 900_000,
    runProcess,
  } = options
  if (typeof runProcess !== 'function') throw new Error('Не настроен запуск Codex')
  const imagePaths = manifest.pages.map(page => path.join(documentDirectory, 'pages', path.basename(page.image)))
  for (const imagePath of imagePaths) {
    if (!fs.existsSync(imagePath)) throw new Error(`Не найдено изображение страницы: ${path.basename(imagePath)}`)
  }
  const prompt = buildDocumentPrompt(filename, manifest)
  const args = buildCodexArguments({ model, workdir, imagePaths, schemaPath, outputPath, prompt })
  let result
  try {
    result = await runProcess(codexBin, args, timeoutMs)
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('Codex CLI не найден. Установите Codex и выполните codex login')
    throw error
  }
  if (result.code !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim().split('\n').slice(-8).join('\n')
    throw new Error(detail || `Codex завершился с кодом ${result.code}`)
  }
  let raw
  try {
    raw = JSON.parse(await fs.promises.readFile(outputPath, 'utf8'))
  } catch (error) {
    throw new Error(`Codex вернул некорректный JSON: ${error.message}`)
  }
  const analysis = normalizeCodexAnalysis(raw, manifest)
  analysis.engine = `Codex Document Agent (${model})`
  analysis.generatedAt = new Date().toISOString()
  analysis.rawOutputPath = path.basename(outputPath)
  return analysis
}

module.exports = {
  AGENT_TYPES,
  analyzeDocumentWithCodex,
  buildCodexArguments,
  buildDocumentPrompt,
  normalizeCodexAnalysis,
}
