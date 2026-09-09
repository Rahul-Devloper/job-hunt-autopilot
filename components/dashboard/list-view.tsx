'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Mail, Trash2, Loader2, Edit2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { statusColors, statusLabels } from './job-card'
import type { Job } from '@/types'

interface ListViewProps {
  jobs: Job[]
  onDelete?: (id: string) => void
  onFindEmail?: (id: string) => void
  onSendEmail?: (id: string) => void
  onManualEmail?: (id: string, existingEmail?: string) => void
  onRemoveEmail?: (id: string) => void
  findingEmail?: string | null
}

export function ListView({ jobs, onDelete, onFindEmail, onSendEmail, onManualEmail, onRemoveEmail, findingEmail }: ListViewProps) {
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
                HR Email
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
                <td className="px-6 py-4">
                  {job.hr_email ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground">{job.hr_email}</span>
                      {job.email_source === 'manual' && (
                        <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 text-xs dark:text-blue-400 dark:border-blue-500/40">
                          Manual
                        </Badge>
                      )}
                      {job.email_type === 'personal' && (
                        <Badge className="gap-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30 dark:hover:bg-green-500/20">
                          ★ Personal
                        </Badge>
                      )}
                      {job.email_type === 'generic' && job.email_source !== 'manual' && (
                        <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
                          Generic
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        title="Edit email"
                        onClick={() => onManualEmail?.(job.id, job.hr_email ?? undefined)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        title="Remove email"
                        onClick={() => onRemoveEmail?.(job.id)}
                      >
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => onManualEmail?.(job.id)}
                    >
                      <Mail className="mr-1 h-3 w-3" />
                      Add Email
                    </Button>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(job.created_at!), { addSuffix: true })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    {!job.hr_email && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => onFindEmail?.(job.id)}
                        disabled={findingEmail === job.id}
                      >
                        {findingEmail === job.id ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Finding...
                          </>
                        ) : (
                          'Find Email'
                        )}
                      </Button>
                    )}
                    {job.hr_email && (
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
