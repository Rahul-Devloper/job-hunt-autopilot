'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Mail, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { statusColors, statusLabels } from './job-card'
import { ExtractionConfidenceBadge } from '@/components/dashboard/extraction-confidence-badge'
import type { BoardJob } from '@/types'

interface ListViewProps {
  jobs: BoardJob[]
  onDelete?: (id: string) => void
  onSendEmail?: (id: string) => void
}

export function ListView({ jobs, onDelete, onSendEmail }: ListViewProps) {
  return (
    <div className="h-full p-8">
      <div className="h-full overflow-auto rounded-lg border bg-card">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Job Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Captured
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-muted/50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold text-muted-foreground">
                      {job.company_name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{job.company_name}</span>
                    <ExtractionConfidenceBadge confidence={job.extraction_confidence} />
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-foreground max-w-xs truncate">
                  {job.job_title}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {job.location || '—'}
                </td>
                <td className="px-6 py-4">
                  <Badge className={statusColors[job.status]}>
                    {statusLabels[job.status]}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(job.created_at!), { addSuffix: true })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    {job.contact_count > 0 && (
                      <Button
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onSendEmail?.(job.id)}
                        title="Send Email"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <a
                      href={job.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View job"
                      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 w-7 p-0')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => onDelete?.(job.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {jobs.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No jobs to display</p>
          </div>
        )}
      </div>
    </div>
  )
}
