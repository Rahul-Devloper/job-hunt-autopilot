/**
 * One-time backfill: embeds every `jobs` row with `job_embedding IS NULL`.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts --dry-run   (no API calls, no writes — just lists what would happen)
 *   npx tsx scripts/backfill-embeddings.ts             (real run — calls Gemini, writes job_embedding)
 *
 * Safe to re-run: only ever selects rows still NULL, so an interrupted run picks up where it left off.
 */
import { createClient } from '@supabase/supabase-js'
import { generateEmbedding, MIN_EMBEDDABLE_TEXT_LENGTH } from '../lib/embeddings'

const DELAY_BETWEEN_JOBS_MS = 1500
const RETRY_DELAYS_MS = [3000, 6000]

const isDryRun = process.argv.includes('--dry-run')

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

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Backfill] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, job_title, company_name, job_description')
    .is('job_embedding', null)

  if (error) {
    console.error('[Backfill] Failed to fetch jobs:', error.message)
    process.exit(1)
  }

  console.log(`[Backfill] ${jobs.length} job(s) with job_embedding IS NULL`)
  if (isDryRun) console.log('[Backfill] --dry-run: no API calls, no writes\n')

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

    if (isDryRun) {
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

  console.log('\n[Backfill] Done.')
  if (isDryRun) {
    console.log(`[Backfill] Dry run: ${jobs.length - skipped} would be embedded, ${skipped} would be skipped.`)
  } else {
    console.log(`[Backfill] Final: ${embedded} embedded, ${skipped} skipped, ${failed} failed (of ${jobs.length}).`)
  }
  if (skippedRows.length) console.log('[Backfill] Skipped:', skippedRows)
  if (failedRows.length) console.log('[Backfill] Failed:', failedRows)
}

main()
