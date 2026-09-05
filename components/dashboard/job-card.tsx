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
  captured: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  email_found: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  email_sent: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  interview: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  offer: 'bg-green-100 text-green-800 hover:bg-green-100',
  rejected: 'bg-red-100 text-red-800 hover:bg-red-100',
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
    if (!job.company_linkedin_url) {
      alert('No company LinkedIn URL captured. Please recapture this job to enable HR contact extraction.')
      return
    }

    setFindingContacts(true)

    try {
      const slug = job.company_linkedin_url
        .replace('https://www.linkedin.com/company/', '')
        .replace(/\/$/, '')

      const peopleUrl = `https://www.linkedin.com/company/${slug}/people/?keywords=recruiter+talent+acquisition+HR+hiring&jha_job_id=${job.id}`
      window.open(peopleUrl, '_blank')

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
      alert('Error opening LinkedIn people page')
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                {job.company_name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{job.company_name}</h3>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(job.created_at!), { addSuffix: true })}
                </p>
              </div>
            </div>

            <h4 className="mt-3 text-sm font-medium text-gray-900 line-clamp-2">
              {job.job_title}
            </h4>

            {job.location && (
              <p className="mt-1 text-xs text-gray-500">{job.location}</p>
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
              {!job.company_linkedin_url && (
                <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-300">
                  ⚠️ Recapture for HR extraction
                </Badge>
              )}
              {job.hr_email && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{job.hr_email}</span>
                </Badge>
              )}
              {job.email_type === 'personal' && (
                <Badge className="gap-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs">
                  ★ Personal
                </Badge>
              )}
              {job.hr_email && job.email_type === 'generic' && (
                <Badge variant="outline" className="gap-1 text-gray-500 text-xs">
                  Generic
                </Badge>
              )}
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
                className="text-red-600 cursor-pointer"
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
