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
import { Checkbox } from '@/components/ui/checkbox'

interface ManualEmailDialogProps {
  open: boolean
  onClose: () => void
  jobId: string
  companyName: string
  onSuccess: () => void
}

export function ManualEmailDialog({
  open,
  onClose,
  jobId,
  companyName,
  onSuccess,
}: ManualEmailDialogProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [contribute, setContribute] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/emails/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          hr_email: email,
          hr_name: name || undefined,
          contribute,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save email')
      }

      alert(data.message)
      onSuccess()
      onClose()
      setEmail('')
      setName('')
    } catch (error) {
      console.error('Error saving email:', error)
      alert('Failed to save email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add HR Email Manually</DialogTitle>
            <DialogDescription>
              Enter the HR contact email for {companyName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">HR Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="hr@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="name">HR Name (Optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="contribute"
                checked={contribute}
                onCheckedChange={(checked) => setContribute(checked as boolean)}
              />
              <Label
                htmlFor="contribute"
                className="text-sm font-normal cursor-pointer"
              >
                Contribute this email to community database (help other job seekers!)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
