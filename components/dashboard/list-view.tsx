'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Mail, Trash2, Loader2, Edit2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
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

const statusColors: Record<string, string> = {
  captured: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  email_found: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  email_sent: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  interview: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  offer: 'bg-green-100 text-green-800 hover:bg-green-100',
  rejected: 'bg-red-100 text-red-800 hover:bg-red-100',
}

const statusLabels: Record<string, string> = {
  captured: 'Captured',
  email_found: 'Email Found',
  email_sent: 'Email Sent',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

export function ListView({ jobs, onDelete, onFindEmail, onSendEmail, onManualEmail, onRemoveEmail, findingEmail }: ListViewProps) {
  return (
    <div className="p-8">
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Job Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                HR Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Captured
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-600">
                      {job.company_name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{job.company_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                  {job.job_title}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
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
                      <span className="text-sm text-gray-900">{job.hr_email}</span>
                      {job.email_source === 'manual' && (
                        <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 text-xs">
                          Manual
                        </Badge>
                      )}
                      {job.email_type === 'personal' && (
                        <Badge className="gap-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs">
                          ★ Personal
                        </Badge>
                      )}
                      {job.email_type === 'generic' && job.email_source !== 'manual' && (
                        <Badge variant="outline" className="gap-1 text-gray-500 text-xs">
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
                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
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
            <p className="text-sm text-gray-500">No jobs to display</p>
          </div>
        )}
      </div>
    </div>
  )
}
