/**
 * Manually test askJHA() with your own question, against real production data.
 *
 * Usage:
 *   npx tsx scripts/ask-jha.ts "Which jobs need AWS experience?"
 */
import { createClient } from '@supabase/supabase-js'
import { askJHA } from '../lib/ask-jha'

const question = process.argv.slice(2).join(' ')

if (!question) {
  console.error('Usage: npx tsx scripts/ask-jha.ts "your question here"')
  process.exit(1)
}

async function main() {
  // match_jobs now requires a user id (searches are always scoped to one user's own jobs) — this
  // dev script looks up the account's own id rather than taking it as an argument, since this
  // project has exactly one real account today.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: job, error } = await supabase.from('jobs').select('user_id').limit(1).single()
  if (error || !job) {
    console.error('Could not find a user_id to search — is the jobs table empty?', error)
    process.exit(1)
  }

  console.log(`Q: ${question}\n`)
  const result = await askJHA(question, job.user_id)
  console.log(`Answer:\n${result.answer}`)
  console.log(`\nSources (${result.sources.length}):`)
  for (const s of result.sources) console.log(`  - [${s.status}] ${s.job_title} @ ${s.company_name}`)
}

main()
