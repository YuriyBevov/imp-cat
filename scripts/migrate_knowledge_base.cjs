const fs = require('node:fs')
const path = require('node:path')
const { createAitunnelEmbeddingProvider } = require('../lib/embedding-provider.cjs')
const { createKnowledgeBase } = require('../lib/knowledge-base.cjs')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Для миграции задайте DATABASE_URL')
  const apiKey = process.env.TRANSLATION_API_KEY || process.env.AI_API_KEY || ''
  if (!apiKey) throw new Error('Для полноценных embeddings задайте TRANSLATION_API_KEY')
  const sourcePath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'studio', 'translation-memory.json'))
  let parsed
  try { parsed = JSON.parse(await fs.promises.readFile(sourcePath, 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Файловая БЗ не найдена: миграция не требуется')
      return
    }
    throw error
  }
  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : []
  const provider = createAitunnelEmbeddingProvider({
    apiUrl: process.env.TRANSLATION_API_URL || process.env.AI_API_URL,
    apiKey,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: process.env.EMBEDDING_DIMENSIONS || 1_536,
  })
  const knowledgeBase = createKnowledgeBase({
    connectionString: process.env.DATABASE_URL,
    embeddingProvider: provider,
    dimensions: process.env.EMBEDDING_DIMENSIONS || 1_536,
  })
  try {
    let created = 0
    for (let offset = 0; offset < entries.length; offset += 100) {
      const result = await knowledgeBase.addMany(entries.slice(offset, offset + 100))
      created += result.created
    }
    console.log(`Миграция завершена: исходных записей ${entries.length}, создано ${created}`)
  } finally {
    await knowledgeBase.close()
  }
}

main().catch(error => {
  console.error(`Ошибка миграции БЗ: ${error.message}`)
  process.exitCode = 1
})
