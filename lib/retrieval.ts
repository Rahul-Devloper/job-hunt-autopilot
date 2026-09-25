import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'

export interface MatchedJob {
  id: string
  job_title: string
  company_name: string
  job_description: string | null
  job_url: string
  distance: number
}

/**
 * Embeds `question` and runs a pgvector similarity search (match_jobs RPC) against
 * jobs.job_embedding. Never throws — returns [] and logs on any failure (embedding failed,
 * RPC error), matching this project's soft-fail convention for optional/best-effort features.
 */
export async function findRelevantJobs(
  question: string,
  options: { matchCount?: number; maxDistance?: number } = {},
): Promise<MatchedJob[]> {
  const embedding = await generateEmbedding(question, 'RETRIEVAL_QUERY')

  if (embedding === null) {
    console.error('[Retrieval] Could not embed question — returning no matches', {
      questionLength: question.trim().length,
    })
    return []
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('match_jobs', {
    query_embedding: JSON.stringify(embedding),
    ...(options.matchCount !== undefined && { match_count: options.matchCount }),
    ...(options.maxDistance !== undefined && { max_distance: options.maxDistance }),
  })

  if (error) {
    console.error('[Retrieval] match_jobs RPC failed:', error.message)
    return []
  }

  return (data as MatchedJob[]) || []
}
