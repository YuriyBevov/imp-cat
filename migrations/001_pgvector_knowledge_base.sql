CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS icat_glossaries (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_language varchar(20) NOT NULL DEFAULT 'auto',
  target_language varchar(20) NOT NULL DEFAULT 'ru',
  domain text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS icat_translation_memory (
  id text PRIMARY KEY,
  glossary_id text NOT NULL REFERENCES icat_glossaries(id) ON DELETE RESTRICT,
  source_text text NOT NULL,
  source_canonical text NOT NULL,
  translation text NOT NULL,
  source_language varchar(20) NOT NULL DEFAULT 'auto',
  target_language varchar(20) NOT NULL DEFAULT 'ru',
  embedding vector(1536),
  embedding_model text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (glossary_id, source_language, target_language, source_canonical)
);

CREATE INDEX IF NOT EXISTS icat_translation_memory_embedding_hnsw
  ON icat_translation_memory USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS icat_translation_memory_lookup
  ON icat_translation_memory (glossary_id, source_language, target_language, source_canonical);
