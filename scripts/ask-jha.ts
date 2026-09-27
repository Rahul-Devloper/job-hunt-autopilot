/**
 * Manually test askJHA() with your own question, against real production data.
 *
 * Usage:
 *   npx tsx scripts/ask-jha.ts "Which jobs need AWS experience?"
 */
import { askJHA } from '../lib/ask-jha'

const question = process.argv.slice(2).join(' ')

if (!question) {
  console.error('Usage: npx tsx scripts/ask-jha.ts "your question here"')
  process.exit(1)
}

async function main() {
  console.log(`Q: ${question}\n`)
  const result = await askJHA(question)
  console.log(`Answer:\n${result.answer}`)
  console.log(`\nSources (${result.sources.length}):`)
  for (const s of result.sources) console.log(`  - ${s.job_title} @ ${s.company_name}`)
}

main()
