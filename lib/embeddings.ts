import { GoogleGenAI } from '@google/genai'

// gemini-embedding-001's confirmed inputTokenLimit is 2048 (checked live via
// ai.models.get({ model: 'gemini-embedding-001' }), not assumed). Gemini's embedContent silently
// truncates oversized input server-side rather than erroring, so this client-side guard exists to
// make truncation visible (logged) instead of silent. 8000 chars ≈ 2048 tokens at the SDK's own
// documented ~4 chars/token approximation, which undercounts real capacity for this project's job
// descriptions (observed ~5.2–5.5 chars/token) — so it leaves real margin under the actual limit.
export const MIN_EMBEDDABLE_TEXT_LENGTH = 20
const MAX_EMBEDDABLE_TEXT_LENGTH = 8000
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
const EMBEDDING_TIMEOUT_MS = 10000

/**
 * Generates a 768-dim embedding for `text` via Gemini. Never throws — a failed or skipped
 * embed returns null so callers (e.g. a job save) can proceed without one.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  let trimmed = (text || '').trim()

  if (trimmed.length < MIN_EMBEDDABLE_TEXT_LENGTH) {
    console.log('[Embeddings] Skipping — text too short to embed usefully', {
      length: trimmed.length,
    })
    return null
  }

  if (trimmed.length > MAX_EMBEDDABLE_TEXT_LENGTH) {
    console.log('[Embeddings] Truncating text before embedding — over safe length', {
      originalLength: trimmed.length,
      truncatedTo: MAX_EMBEDDABLE_TEXT_LENGTH,
    })
    trimmed = trimmed.slice(0, MAX_EMBEDDABLE_TEXT_LENGTH)
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[Embeddings] GEMINI_API_KEY not configured')
    return null
  }

  const ai = new GoogleGenAI({ apiKey })

  try {
    const embedPromise = ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [trimmed],
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: 'RETRIEVAL_DOCUMENT',
      },
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Gemini embedding request timed out')),
        EMBEDDING_TIMEOUT_MS,
      ),
    )

    const response = await Promise.race([embedPromise, timeoutPromise])

    const values = response.embeddings?.[0]?.values
    if (!values || values.length !== EMBEDDING_DIMENSIONS) {
      console.error('[Embeddings] Unexpected response shape', {
        received: values?.length ?? 0,
        expected: EMBEDDING_DIMENSIONS,
      })
      return null
    }

    return values
  } catch (error) {
    console.error(
      '[Embeddings] Gemini error:',
      error instanceof Error ? error.message : error,
    )
    return null
  }
}
