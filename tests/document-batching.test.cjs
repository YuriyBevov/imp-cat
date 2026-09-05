const test = require('node:test')
const assert = require('node:assert/strict')

const { mergeBatchAnalyses, planDocumentBatches } = require('../lib/document-batching.cjs')

function manifest(pageCount) {
  return {
    pages: Array.from({ length: pageCount }, (_, index) => ({
      index,
      width: 1200,
      height: 1800,
      image: `page-${String(index + 1).padStart(3, '0')}.png`,
    })),
  }
}

function batchAnalysis(batch) {
  return {
    engine: 'AITunnel Document Agent (vision-model)',
    model: 'vision-model',
    documentTitle: 'Large document',
    languages: batch.batchNumber % 2 ? ['en'] : ['en', 'tr'],
    pages: batch.manifest.pages.map((page, index) => ({
      index,
      width: page.width,
      height: page.height,
      image: page.image,
      languages: ['en'],
      segments: [{
        segmentId: 'segment-1',
        flowGroup: `page-${index + 1}-body`,
        sourceText: `Document page ${page.documentPageIndex + 1}`,
      }],
    })),
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300, costRub: 1.5 },
    rawOutputPath: `response-${batch.batchNumber}.json`,
  }
}

test('plans more than 30 pages as sequential two-page batches', () => {
  const batches = planDocumentBatches(manifest(31), { modelMaxOutputTokens: 384_000 })
  assert.equal(batches.length, 16)
  assert.deepEqual(batches[0].manifest.pages.map(page => page.index), [0, 1])
  assert.deepEqual(batches[0].manifest.pages.map(page => page.documentPageIndex), [0, 1])
  assert.deepEqual(batches[15].manifest.pages.map(page => page.documentPageIndex), [30])
  assert.equal(batches[0].maxOutputTokens, 384_000)
  assert.equal(batches[15].maxOutputTokens, 384_000)
})

test('does not derive batch size or response limit from a per-page token estimate', () => {
  const batches = planDocumentBatches(manifest(3), { pageLimit: 4, modelMaxOutputTokens: 40_000 })
  assert.equal(batches.length, 1)
  assert.equal(batches[0].maxOutputTokens, 40_000)
})

test('leaves max output unset when the provider catalog does not publish it', () => {
  const batches = planDocumentBatches(manifest(2))
  assert.equal(batches[0].maxOutputTokens, null)
})

test('merges batch pages in document order and aggregates usage', () => {
  const sourceManifest = manifest(5)
  const batches = planDocumentBatches(sourceManifest)
  const merged = mergeBatchAnalyses(
    batches.map(batch => ({ batch, analysis: batchAnalysis(batch) })),
    sourceManifest,
  )
  assert.deepEqual(merged.pages.map(page => page.index), [0, 1, 2, 3, 4])
  assert.deepEqual(merged.pages.map(page => page.segments[0].sourceText), [
    'Document page 1', 'Document page 2', 'Document page 3', 'Document page 4', 'Document page 5',
  ])
  assert.equal(merged.pages[2].segments[0].flowGroup, 'page-3-body')
  assert.equal(new Set(merged.pages.map(page => page.segments[0].segmentId)).size, 5)
  assert.equal(merged.batchCount, 3)
  assert.equal(merged.usage.totalTokens, 900)
  assert.equal(merged.usage.costRub, 4.5)
  assert.deepEqual(merged.languages, ['en', 'tr'])
})

test('rejects an incomplete merged document', () => {
  const sourceManifest = manifest(3)
  const batches = planDocumentBatches(sourceManifest)
  assert.throws(
    () => mergeBatchAnalyses([{ batch: batches[0], analysis: batchAnalysis(batches[0]) }], sourceManifest),
    /собрал 2 стр\. вместо 3/,
  )
})
