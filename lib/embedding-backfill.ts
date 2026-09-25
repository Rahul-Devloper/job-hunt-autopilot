import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbedding, MIN_EMBEDDABLE_TEXT_LENGTH } from '@/lib/embeddings'

const DELAY_BETWEEN_JOBS_MS = 1500
const RETRY_DELAYS_MS = [3000, 6000]

export interface BackfillOptions {
  /** List what would happen without calling Gemini or writing anything. */
  dryRun?: boolean
  /** Cap on rows processed in one call — a safety ceiling for an unattended/scheduled run. Omit for no cap (the CLI script's use case). */
  maxRows?: number
}

export interface BackfillResult {
  total: number
  embedded: number
  skipped: number
  failed: number
  skippedRows: string[]
  failedRows: string[]
  dryRun: boolean
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function embedWithRetry(description: string): Promise<number[] | null> {
  let attempt = 0
  while (true) {
    const result = await generateEmbedding(description)
    if (result !== null) return result
    if (attempt >= RETRY_DELAYS_MS.length) return null

    const delay = RETRY_DELAYS_MS[attempt]
    console.log(`[Backfill] Attempt ${attempt + 1} returned null — retrying in ${delay}ms`)
    await sleep(delay)
    attempt += 1
  }
}

/**
 * Sweeps `jobs` rows with `job_embedding IS NULL`, embeds and writes them back. Safe to re-run —
 * only ever touches rows still NULL, so an interrupted or capped run picks up next time. Shared by
 * the one-time CLI script (scripts/backfill-embeddings.ts) and the scheduled cron route
 * (app/api/cron/embed-backfill/route.ts) — do not duplicate this logic in either caller.
 */
export async function runEmbeddingBackfill(options: BackfillOptions = {}): Promise<BackfillResult> {
  const dryRun = options.dryRun ?? false
  const maxRows = options.maxRows

  const supabase = createServiceClient()

  let query = supabase
    .from('jobs')
    .select('id, job_title, company_name, job_description')
    .is('job_embedding', null)
  if (maxRows !== undefined) query = query.limit(maxRows)

  const { data: jobs, error } = await query

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`)
  }

  console.log(`[Backfill] ${jobs.length} job(s) with job_embedding IS NULL${maxRows !== undefined ? ` (maxRows=${maxRows})` : ''}`)
  if (dryRun) console.log('[Backfill] dryRun: no API calls, no writes')

  let embedded = 0
  let skipped = 0
  let failed = 0
  const skippedRows: string[] = []
  const failedRows: string[] = []

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const description = (job.job_description || '').trim()
    const label = `${job.job_title} @ ${job.company_name} (${job.id})`

    if (description.length < MIN_EMBEDDABLE_TEXT_LENGTH) {
      console.log(`[Backfill] ${i + 1}/${jobs.length} SKIP (too short, ${description.length} chars) — ${label}`)
      skipped += 1
      skippedRows.push(label)
      continue
    }

    if (dryRun) {
      console.log(`[Backfill] ${i + 1}/${jobs.length} would embed (${description.length} chars) — ${label}`)
      continue
    }

    const vector = await embedWithRetry(description)

    if (vector === null) {
      console.error(`[Backfill] ${i + 1}/${jobs.length} FAILED — ${label}`)
      failed += 1
      failedRows.push(label)
    } else {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ job_embedding: JSON.stringify(vector) })
        .eq('id', job.id)

      if (updateError) {
        console.error(`[Backfill] ${i + 1}/${jobs.length} FAILED (write error: ${updateError.message}) — ${label}`)
        failed += 1
        failedRows.push(label)
      } else {
        console.log(`[Backfill] ${i + 1}/${jobs.length} embedded — ${label}`)
        embedded += 1
      }
    }

    console.log(`[Backfill] Progress: ${i + 1}/${jobs.length} processed — ${embedded} embedded, ${skipped} skipped, ${failed} failed`)

    if (i < jobs.length - 1) await sleep(DELAY_BETWEEN_JOBS_MS)
  }

  console.log('[Backfill] Done.', dryRun
    ? `Dry run: ${jobs.length - skipped} would be embedded, ${skipped} would be skipped.`
    : `Final: ${embedded} embedded, ${skipped} skipped, ${failed} failed (of ${jobs.length}).`)

  return { total: jobs.length, embedded, skipped, failed, skippedRows, failedRows, dryRun }
}
