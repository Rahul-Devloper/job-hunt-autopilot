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
import { Badge } from '@/components/ui/badge'
import { Info, X, UserPlus, Send, Loader2 } from 'lucide-react'
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEFAULT_TEMPLATE = `Hi {hr_name},

I came across the {role} position at {company} and I'm very interested in applying.

I'm a Full Stack Developer with 2.5 years of experience in React, TypeScript, and Node.js. I believe my background aligns well with what you're looking for.

I'd love to discuss how I can contribute to your team. Are you available for a brief chat this week?

Best regards,
[Your Name]`

export function EmailComposer({ open, onClose, job, onSuccess }: EmailComposerProps) {
  const [subject, setSubject] = useState(`Your Next ${job.job_title}`)
  const [body, setBody] = useState(DEFAULT_TEMPLATE)
  const [sending, setSending] = useState(false)

  // Sender
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')

  // Recipients
  const [contacts, setContacts] = useState<JobContact[]>([])
  const [recipientInput, setRecipientInput] = useState(job.hr_email || '')
  const [emailError, setEmailError] = useState('')

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
        const primary = list.find((a) => a.is_primary) ?? list[0]
        if (primary) setSelectedAccount(primary.id)
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
        // Pre-fill To with primary contact (or hr_email fallback)
        const primary = list.find((c) => c.is_primary)
        if (primary) {
          setRecipientInput(primary.email)
        }
      }
    } catch {
      console.error('Failed to load contacts')
    }
  }

  // --- recipient helpers ---

  function parseRecipients(str: string): string[] {
    return str
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
  }

  function validateEmails(str: string): boolean {
    if (!str.trim()) {
      setEmailError('At least one recipient is required')
      return false
    }
    const emails = parseRecipients(str)
    const invalid = emails.filter((e) => !EMAIL_RE.test(e))
    if (invalid.length > 0) {
      setEmailError(`Invalid: ${invalid.join(', ')}`)
      return false
    }
    setEmailError('')
    return true
  }

  function handleInputChange(value: string) {
    setRecipientInput(value)
    if (emailError) validateEmails(value) // live-clear once valid
  }

  function addContact(email: string) {
    const current = parseRecipients(recipientInput)
    if (current.includes(email)) return
    const next = [...current, email].join(', ')
    setRecipientInput(next)
    setEmailError('')
  }

  function addAllContacts() {
    const next = contacts.map((c) => c.email).join(', ')
    setRecipientInput(next)
    setEmailError('')
  }

  function removeRecipient(email: string) {
    const next = parseRecipients(recipientInput)
      .filter((e) => e !== email)
      .join(', ')
    setRecipientInput(next)
    if (emailError) validateEmails(next)
  }

  const recipientList = parseRecipients(recipientInput)
  const recipientCount = emailError ? 0 : recipientList.length

  // --- preview ---

  const primaryContact = contacts.find((c) => c.is_primary)
  const previewBody = body
    .replace(/{company}/g, job.company_name)
    .replace(/{role}/g, job.job_title)
    .replace(
      /{hr_name}/g,
      primaryContact?.contact_name || job.hr_name || `${job.company_name} hiring team`
    )

  // --- send ---

  async function handleSend() {
    if (!validateEmails(recipientInput)) return
    if (!selectedAccount) {
      alert('Please select an email account to send from.')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          to: recipientInput,      // comma-separated string; schema parses it
          subject,
          body: previewBody,
          account_id: selectedAccount,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to send email')
      }

      const count: number = data.data.recipient_count ?? 1
      alert(`Email sent to ${count} recipient${count > 1 ? 's' : ''}!`)
      onSuccess()
      onClose()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to send email'
      alert(msg)
    } finally {
      setSending(false)
    }
  }

  const canSend = !sending && !!selectedAccount && recipientList.length > 0 && !emailError

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
          {/* ── Send from ── */}
          <div>
            <Label>Send from</Label>
            <Select value={selectedAccount} onValueChange={(v) => { if (v !== null) setSelectedAccount(v) }}>
              <SelectTrigger>
                <SelectValue placeholder='Select email account' />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.email_address}
                    {a.is_primary ? ' (Primary)' : ''}
                    {!a.is_verified ? ' ⚠️ Not verified' : ''}
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

          {/* ── To field ── */}
          <div>
            <div className='flex items-center justify-between mb-1'>
              <Label htmlFor='to-emails'>
                To{' '}
                {recipientCount > 0 && (
                  <span className='text-blue-600 font-normal text-sm'>
                    ({recipientCount} recipient{recipientCount > 1 ? 's' : ''})
                  </span>
                )}
              </Label>
              {contacts.length > 1 && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-xs text-blue-600 hover:text-blue-800 h-6 px-2'
                  onClick={addAllContacts}
                >
                  <UserPlus className='h-3 w-3 mr-1' />
                  Add all contacts
                </Button>
              )}
            </div>

            <Input
              id='to-emails'
              type='text'
              value={recipientInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={() => validateEmails(recipientInput)}
              placeholder='hr@company.com, manager@company.com'
              className={emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />

            <p className='text-xs text-gray-500 mt-1'>
              Separate multiple emails with commas. All recipients will see each other.
            </p>

            {emailError && (
              <p className='text-xs text-red-600 mt-1'>{emailError}</p>
            )}

            {/* Recipient chips */}
            {recipientList.length > 0 && !emailError && (
              <div className='flex flex-wrap gap-1.5 mt-2'>
                {recipientList.map((email) => (
                  <Badge key={email} variant='secondary' className='pl-2 pr-1 py-0.5 text-xs gap-1'>
                    {email}
                    <button
                      type='button'
                      onClick={() => removeRecipient(email)}
                      className='rounded-full hover:bg-gray-300 p-0.5'
                    >
                      <X className='h-2.5 w-2.5' />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Quick-add contact buttons */}
            {contacts.length > 0 && (
              <div className='mt-2'>
                <p className='text-xs text-gray-500 mb-1'>Quick add:</p>
                <div className='flex flex-wrap gap-1'>
                  {contacts.map((contact) => {
                    const isAdded = recipientList.includes(contact.email)
                    return (
                      <Button
                        key={contact.id}
                        type='button'
                        variant={isAdded ? 'default' : 'outline'}
                        size='sm'
                        disabled={isAdded}
                        className='text-xs h-7'
                        onClick={() => addContact(contact.email)}
                      >
                        {isAdded ? '✓ ' : '+ '}
                        {contact.contact_name || contact.email}
                        {contact.is_primary ? ' (Primary)' : ''}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Info alert for multiple recipients */}
            {recipientCount > 1 && (
              <Alert className='mt-2 bg-blue-50 border-blue-200 py-2'>
                <Info className='h-4 w-4 text-blue-600' />
                <AlertDescription className='text-blue-800 text-xs'>
                  Sending to <strong>{recipientCount} recipients</strong>. All will see each other&apos;s addresses.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* ── Subject ── */}
          <div>
            <Label htmlFor='subject'>Subject</Label>
            <Input
              id='subject'
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* ── Body ── */}
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

          {/* ── Preview ── */}
          <div className='rounded-lg border bg-gray-50 p-3'>
            <p className='mb-2 text-sm font-medium text-gray-700'>Preview:</p>
            <div className='whitespace-pre-wrap text-sm text-gray-900'>{previewBody}</div>
          </div>
        </div>

        <DialogFooter className='shrink-0 pt-2'>
          <Button variant='outline' onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Sending...
              </>
            ) : (
              <>
                <Send className='h-4 w-4 mr-2' />
                Send{recipientCount > 1 ? ` to ${recipientCount}` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
