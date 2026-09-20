import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ExtractionConfidence } from '@/types'

interface ExtractionConfidenceBadgeProps {
  confidence: ExtractionConfidence
}

// Renders nothing for 'ok' (the common case) and for any value this build doesn't recognize —
// an unknown future enum value must degrade to invisible, never crash the row (see D1).
export function ExtractionConfidenceBadge({ confidence }: ExtractionConfidenceBadgeProps) {
  if (confidence === 'degraded') {
    return (
      <Badge
        title="The scraper had to fall back to a last-resort selector for this job — double-check the captured data."
        className="gap-1 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/20"
      >
        <AlertTriangle className="h-3 w-3" />
        Degraded capture
      </Badge>
    )
  }

  if (confidence === 'failed') {
    return (
      <Badge
        title="The scraper could not reliably extract this job's company name or title — LinkedIn's page structure may have changed."
        variant="destructive"
        className="gap-1 text-xs"
      >
        <AlertTriangle className="h-3 w-3" />
        Extraction failed
      </Badge>
    )
  }

  return null
}
