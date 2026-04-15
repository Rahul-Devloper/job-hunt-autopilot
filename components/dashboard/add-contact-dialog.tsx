'use client'

import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AddContactDialogProps {
  open: boolean
  onClose: () => void
  jobId: string
  companyName: string
  onSuccess: () => void
}

const CONTACT_ROLES = [
  'HR Department',
  'Hiring Manager',
  'Recruiter',
  'Technical Lead',
  'Team Lead',
  'Engineering Manager',
  'Other',
]

const CONTACT_SOURCES = [
  { value: 'manual', label: 'Added manually' },
  { value: 'linkedin', label: 'Found on LinkedIn' },
  { value: 'company_website', label: 'Company website' },
  { value: 'referral', label: 'Referral' },
]

export function AddContactDialog({
  open,
  onClose,
  jobId,
  companyName,
  onSuccess,
}: AddContactDialogProps) {
  const [email, setEmail] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('HR Department')
  const [contactSource, setContactSource] = useState<string>('manual')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setEmail('')
    setContactName('')
    setContactRole('HR Department')
    setContactSource('manual')
    setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/jobs/${jobId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          contact_name: contactName || undefined,
          contact_role: contactRole || undefined,
          contact_source: contactSource,
          notes: notes || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to add contact')
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to add contact'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Add an email contact for {companyName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="contact-email">Email *</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="hr@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="contact-name">Name (Optional)</Label>
              <Input
                id="contact-name"
                type="text"
                placeholder="Jane Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="contact-role">Role</Label>
              <Select value={contactRole} onValueChange={(v) => { if (v !== null) setContactRole(v) }}>
                <SelectTrigger id="contact-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contact-source">Source</Label>
              <Select value={contactSource} onValueChange={(v) => { if (v !== null) setContactSource(v) }}>
                <SelectTrigger id="contact-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contact-notes">Notes (Optional)</Label>
              <Textarea
                id="contact-notes"
                placeholder="e.g. Very responsive, Out of office until..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
