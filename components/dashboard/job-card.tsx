'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreVertical, ExternalLink, Mail, Trash2, Loader2, Edit2, X, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buttonVariants } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { ContactList } from '@/components/dashboard/contact-list'
import { ExtractionConfidenceBadge } from '@/components/dashboard/extraction-confidence-badge'
import type { Job, JobStatus } from '@/types'

interface JobCardProps {
  job: Job
  onDelete?: (id: string) => void
  onFindEmail?: (id: string) => void
  onSendEmail?: (id: string) => void
  onManualEmail?: (id: string, existingEmail?: string) => void
  onRemoveEmail?: (id: string) => void
  onStatusChange?: (id: string, status: JobStatus) => void
  findingEmail?: string | null
  onRefresh?: () => void
}

export const statusColors: Record<string, string> = {
  captured:
    'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-500/20 dark:text-gray-300 dark:hover:bg-gray-500/20',
  email_found:
    'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/20',
  email_sent:
    'bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-500/20 dark:text-purple-300 dark:hover:bg-purple-500/20',
  interview:
    'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-500/20 dark:text-yellow-300 dark:hover:bg-yellow-500/20',
  offer:
    'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-500/20 dark:text-green-300 dark:hover:bg-green-500/20',
  rejected:
    'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/20',
}

export const statusLabels: Record<string, string> = {
  captured: 'Captured',
  email_found: 'Email Found',
  email_sent: 'Email Sent',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

export function JobCard({
  job,
  onDelete,
  onFindEmail,
  onSendEmail,
  onManualEmail,
  onRemoveEmail,
  onStatusChange,
  findingEmail,
  onRefresh,
}: JobCardProps) {
  const [contactsOpen, setContactsOpen] = useState(false)
  const [findingContacts, setFindingContacts] = useState(false)

  async function handleFindContacts() {
    setFindingContacts(true)

    try {
      // LinkedIn rewrites the URL to its canonical form on load, stripping
      // jha_job_id — so hand the job id to the extension via storage before
      // opening the tab. The URL param is kept as a harmless fallback.
      window.postMessage({ type: 'JHA_SET_ACTIVE_JOB', jobId: job.id }, '*')

      // The company /people/ page no longer lists individual profiles —
      // LinkedIn replaced it with aggregate stat cards. The people SEARCH
      // page still shows real profiles with names/titles/links, so that's
      // the live path now; it only needs the company name, not a captured
      // company LinkedIn slug.
      const keywords = encodeURIComponent(`talent acquisition recruiter ${job.company_name}`)
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${keywords}&jha_job_id=${job.id}`
      window.open(searchUrl, '_blank')

      setContactsOpen(true)

      // Refresh jobs when user tabs back — extension will have saved contacts by then
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
          onRefresh?.()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
    } catch {
      alert('Error opening LinkedIn search page')
    } finally {
      setFindingContacts(false)
    }
  }

  return (
    <>
      <Card className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                {job.company_name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{job.company_name}</h3>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(job.created_at!), { addSuffix: true })}
                </p>
              </div>
            </div>

            <h4 className="mt-3 text-sm font-medium text-foreground line-clamp-2">
              {job.job_title}
            </h4>

            {job.location && (
              <p className="mt-1 text-xs text-muted-foreground">{job.location}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Select
                value={job.status}
                onValueChange={(v) => {
                  if (v !== null) onStatusChange?.(job.id, v as JobStatus)
                }}
              >
                <SelectTrigger
                  size="sm"
                  className={cn(
                    'gap-1 border-0 py-0.5 text-xs font-medium rounded-full',
                    statusColors[job.status]
                  )}
                >
                  <SelectValue>{statusLabels[job.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {job.hr_email && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{job.hr_email}</span>
                </Badge>
              )}
              {job.email_type === 'personal' && (
                <Badge className="gap-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30 dark:hover:bg-green-500/20">
                  ★ Personal
                </Badge>
              )}
              {job.hr_email && job.email_type === 'generic' && (
                <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
                  Generic
                </Badge>
              )}
              <ExtractionConfidenceBadge confidence={job.extraction_confidence} />
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              {!job.hr_email && (
                <>
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => onManualEmail?.(job.id)}
                  >
                    <Mail className="mr-1 h-3 w-3" />
                    Add Email
                  </Button>
                </>
              )}
              {job.hr_email && (
                <Button
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onSendEmail?.(job.id)}
                >
                  Send Email
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => setContactsOpen(true)}
              >
                <Users className="mr-1 h-3 w-3" />
                Contacts
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={handleFindContacts}
                disabled={findingContacts}
              >
                {findingContacts ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Users className="mr-1 h-3 w-3" />
                    Find LinkedIn HR Contacts
                  </>
                )}
              </Button>
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 w-7 p-0')}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-8 w-8 p-0 shrink-0'
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: '160px' }}>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setContactsOpen(true)}
              >
                <Users className="mr-2 h-4 w-4" />
                Manage Contacts
              </DropdownMenuItem>
              {job.hr_email && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => onManualEmail?.(job.id, job.hr_email ?? undefined)}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Email
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => onRemoveEmail?.(job.id)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove Email
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 dark:text-red-400 cursor-pointer"
                onClick={() => onDelete?.(job.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <ContactList
        jobId={job.id}
        companyName={job.company_name}
        open={contactsOpen}
        onClose={() => setContactsOpen(false)}
      />
    </>
  )
}
