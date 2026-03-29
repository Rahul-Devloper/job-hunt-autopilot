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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import type { Job } from '@/types'

interface EmailComposerProps {
  open: boolean
  onClose: () => void
  job: Job
  onSuccess: () => void
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
  const [sending, setSending] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLinkedIn() {
      const supabase = createClient()
      const { data } = await supabase
        .from('user_settings')
        .select('linkedin_url')
        .eq('user_id', 'bb468d21-2326-41bf-9c80-3edffa016aca')
        .single()

      setLinkedinUrl(data?.linkedin_url ?? null)
      console.log('Fetched LinkedIn URL:', JSON.stringify(data))
    }

    if (open) {
      fetchLinkedIn()
    }
  }, [open])

  const previewBody = body
    .replace(/{company}/g, job.company_name)
    .replace(/{role}/g, job.job_title)
    .replace(/{hr_name}/g, job.hr_name || `${job.company_name} hiring team`)

  const signaturePreview = linkedinUrl
    ? `\n\n---\nLet's connect on LinkedIn: ${linkedinUrl}`
    : '\n\n---\n⚠️ No LinkedIn URL set (add in user_settings table)'

  async function handleSend() {
    setSending(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          to: job.hr_email,
          subject,
          body: previewBody,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      alert('Email sent successfully!')
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
            Sending to: {job.hr_email}
            {job.email_type === 'personal'
              ? ' (Personal email)'
              : ' (Generic email)'}
          </DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto space-y-4 pr-1'>
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
            <div className='whitespace-pre-wrap text-sm text-gray-900'>
              {previewBody}
              <span className='text-blue-600'>{signaturePreview}</span>
            </div>
            {linkedinUrl && (
              <p className='mt-2 text-xs text-gray-500'>
                LinkedIn link will be tracked when sent
              </p>
            )}
          </div>
        </div>

        <DialogFooter className='shrink-0 pt-2'>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
