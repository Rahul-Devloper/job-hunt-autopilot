/**
 * One-time (or manually re-run) backfill: embeds every `jobs` row with `job_embedding IS NULL`.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts --dry-run   (no API calls, no writes — just lists what would happen)
 *   npx tsx scripts/backfill-embeddings.ts             (real run — calls Gemini, writes job_embedding)
 *
 * Safe to re-run: only ever selects rows still NULL, so an interrupted run picks up where it left off.
 * Core sweep logic lives in lib/embedding-backfill.ts, shared with the scheduled cron route
 * (app/api/cron/embed-backfill/route.ts) — do not duplicate it here.
 */
import { runEmbeddingBackfill } from '../lib/embedding-backfill'

const isDryRun = process.argv.includes('--dry-run')

async function main() {
  const result = await runEmbeddingBackfill({ dryRun: isDryRun })

  if (result.skippedRows.length) console.log('[Backfill] Skipped:', result.skippedRows)
  if (result.failedRows.length) console.log('[Backfill] Failed:', result.failedRows)
}

main().catch((error) => {
  console.error('[Backfill] Fatal error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
