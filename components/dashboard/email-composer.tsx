'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, TrendingUp } from 'lucide-react'
import type { Job } from '@/types'
import type { JobContact } from '@/lib/repositories'

interface EmailComposerProps {
  open: boolean
  onClose: () => void
  job: Job
  onSuccess: () => void
}

interface EmailAccount {
  id: string
  email_address: string
  provider_name: string | null
  is_primary: boolean
  is_verified: boolean
}

const DEFAULT_TEMPLATE = `Hi {hr_name},

I came across the {role} position at {company} and I'm very interested in applying.

I'm a Full Stack Developer with 2.5 years of experience in React, TypeScript, and Node.js. I believe my background aligns well with what you're looking for.

I'd love to discuss how I can contribute to your team. Are you available for a brief chat this week?

Best regards,
[Your Name]`

export function EmailComposer({ open, onClose, job, onSuccess }: EmailComposerProps) {
  const [subject, setSubject] = useState(`Your Next ${job.job_title}`)
  const [body, setBody] = useState(DEFAULT_TEMPLATE)
  const [toEmail, setToEmail] = useState(job.hr_email || '')
  const [sending, setSending] = useState(false)
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [contacts, setContacts] = useState<JobContact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string>('')

  useEffect(() => {
    if (open) {
      loadEmailAccounts()
      loadContacts()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEmailAccounts() {
    try {
      const response = await fetch('/api/email-accounts')
      const data = await response.json()

      if (data.success) {
        const list: EmailAccount[] = data.data || []
        setAccounts(list)

        const primary = list.find((a) => a.is_primary)
        if (primary) {
          setSelectedAccount(primary.id)
        } else if (list.length > 0) {
          setSelectedAccount(list[0].id)
        }
      }
    } catch {
      console.error('Failed to load email accounts')
    }
  }

  async function loadContacts() {
    try {
      const response = await fetch(`/api/jobs/${job.id}/contacts`)
      const data = await response.json()

      if (data.success) {
        const list: JobContact[] = data.data || []
        setContacts(list)

        const primary = list.find((c) => c.is_primary)
        if (primary) {
          setSelectedContactId(primary.id)
          setToEmail(primary.email)
        } else if (list.length > 0) {
          setSelectedContactId(list[0].id)
          setToEmail(list[0].email)
        }
        // If no contacts, fall back to hr_email
      }
    } catch {
      console.error('Failed to load contacts')
    }
  }

  function handleContactChange(contactId: string) {
    setSelectedContactId(contactId)
    const contact = contacts.find((c) => c.id === contactId)
    if (contact) setToEmail(contact.email)
  }

  const selectedContact = contacts.find((c) => c.id === selectedContactId)

  const contactResponseRate =
    selectedContact && selectedContact.emails_sent > 0
      ? ((selectedContact.emails_replied / selectedContact.emails_sent) * 100).toFixed(0)
      : null

  const previewBody = body
    .replace(/{company}/g, job.company_name)
    .replace(/{role}/g, job.job_title)
    .replace(
      /{hr_name}/g,
      selectedContact?.contact_name || job.hr_name || `${job.company_name} hiring team`
    )

  async function handleSend() {
    if (!selectedAccount) {
      alert('Please select an email account to send from.')
      return
    }

    if (!toEmail) {
      alert('Please enter a recipient email address.')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          to: toEmail,
          subject,
          body: previewBody,
          account_id: selectedAccount,
          contact_id: selectedContactId || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to send email')
      }

      alert(`Email sent successfully via ${data.data.provider}!`)
      onSuccess()
      onClose()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to send email'
      alert(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='flex max-h-[90vh] w-[clamp(480px,55vw,800px)] max-w-[calc(100vw-2rem)] flex-col'>
        <DialogHeader className='shrink-0'>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            {job.company_name} — {job.job_title}
          </DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto space-y-4 pr-1'>
          <div>
            <Label>Send from</Label>
            <Select value={selectedAccount} onValueChange={(v) => setSelectedAccount(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder='Select email account' />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.email_address}
                    {account.is_primary ? ' (Primary)' : ''}
                    {!account.is_verified ? ' ⚠️ Not verified' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length === 0 && (
              <p className='text-sm text-amber-600 mt-1'>
                No email accounts configured.{' '}
                <a href='/dashboard/settings/email-accounts' className='underline'>
                  Add one
                </a>
              </p>
            )}
          </div>

          <div>
            <Label>Send to</Label>
            {contacts.length > 0 ? (
              <>
                <Select value={selectedContactId} onValueChange={(v) => { if (v !== null) handleContactChange(v) }}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select contact' />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.email}
                        {contact.is_primary ? ' (Primary)' : ''}
                        {contact.contact_role ? ` · ${contact.contact_role}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedContact && selectedContact.emails_sent > 0 && (
                  <div className='flex items-center gap-3 text-xs text-gray-500 mt-1.5'>
                    <span>{selectedContact.emails_sent} sent</span>
                    <span>{selectedContact.emails_replied} replied</span>
                    {contactResponseRate && (
                      <span className='flex items-center gap-0.5 text-green-600 font-medium'>
                        <TrendingUp className='h-3 w-3' />
                        {contactResponseRate}% response rate
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div>
                <Input
                  type='email'
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder='hr@company.com'
                />
                {job.email_source === 'manual' && (
                  <Alert className='mt-2 bg-blue-50 border-blue-200 py-2'>
                    <Info className='h-4 w-4 text-blue-600' />
                    <AlertDescription className='text-blue-800 text-sm'>
                      Using manually added email address
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor='subject'>Subject</Label>
            <Input
              id='subject'
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor='body'>Email Body</Label>
            <Textarea
              id='body'
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className='font-mono text-sm'
            />
            <p className='mt-1 text-xs text-gray-500'>
              Variables: {'{company}'}, {'{role}'}, {'{hr_name}'}
            </p>
          </div>

          <div className='rounded-lg border bg-gray-50 p-3'>
            <p className='mb-2 text-sm font-medium text-gray-700'>Preview:</p>
            <div className='whitespace-pre-wrap text-sm text-gray-900'>{previewBody}</div>
          </div>
        </div>

        <DialogFooter className='shrink-0 pt-2'>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !selectedAccount}>
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
