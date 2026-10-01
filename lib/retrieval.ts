import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import type { Database } from '@/types/database'

export interface MatchedJob {
  id: string
  job_title: string
  company_name: string
  job_description: string | null
  job_url: string
  status: Database['public']['Enums']['job_status']
  distance: number
}

/**
 * Embeds `question` and runs a pgvector similarity search (match_jobs RPC) against
 * jobs.job_embedding. Never throws — returns [] and logs on any failure (embedding failed,
 * RPC error), matching this project's soft-fail convention for optional/best-effort features.
 *
 * `userId` is required, not optional — match_jobs scopes strictly to that user's own jobs
 * (matches this project's RLS convention, `auth.uid() = user_id`, everywhere else on `jobs`).
 * There is no "search everyone's jobs" mode; a caller must always know whose jobs it's searching.
 *
 * Excludes rejected jobs by default — a rejected job shouldn't be recommended as if it's a live
 * opportunity. This filters before ranking, so an excluded rejected job never displaces a
 * genuinely relevant active one. Pass excludeRejected: false for a future mode that deliberately
 * wants to search rejected applications.
 */
export async function findRelevantJobs(
  question: string,
  userId: string,
  options: { matchCount?: number; maxDistance?: number; excludeRejected?: boolean } = {},
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
    p_user_id: userId,
    ...(options.matchCount !== undefined && { match_count: options.matchCount }),
    ...(options.maxDistance !== undefined && { max_distance: options.maxDistance }),
    ...(options.excludeRejected !== undefined && { exclude_rejected: options.excludeRejected }),
  })

  if (error) {
    console.error('[Retrieval] match_jobs RPC failed:', error.message)
    return []
  }

  return (data as MatchedJob[]) || []
}
