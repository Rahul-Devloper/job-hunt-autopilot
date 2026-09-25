import { NextResponse } from 'next/server'
import { runEmbeddingBackfill } from '@/lib/embedding-backfill'

// Self-imposed ceiling well under Vercel's Hobby default/max of 300s — the maxRows cap below is
// the actual safety mechanism; this just bounds a runaway case.
export const maxDuration = 60

const MAX_ROWS_PER_RUN = 50

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'

  try {
    const result = await runEmbeddingBackfill({ dryRun, maxRows: MAX_ROWS_PER_RUN })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error(
      '[EmbedBackfillCron] Unexpected error:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json({ success: false, error: 'Backfill sweep failed' }, { status: 500 })
  }
}
