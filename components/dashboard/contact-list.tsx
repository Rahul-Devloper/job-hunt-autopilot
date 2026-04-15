'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Mail, Star, Trash2, Plus, TrendingUp } from 'lucide-react'
import { AddContactDialog } from '@/components/dashboard/add-contact-dialog'
import type { JobContact } from '@/lib/repositories'

interface ContactListProps {
  jobId: string
  companyName: string
  open: boolean
  onClose: () => void
  onContactsChanged?: () => void
}

function responseRate(contact: JobContact): number {
  if (contact.emails_sent === 0) return 0
  return (contact.emails_replied / contact.emails_sent) * 100
}

export function ContactList({
  jobId,
  companyName,
  open,
  onClose,
  onContactsChanged,
}: ContactListProps) {
  const [contacts, setContacts] = useState<JobContact[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/contacts`)
      const data = await response.json()
      if (data.success) setContacts(data.data || [])
    } catch {
      console.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    if (open) loadContacts()
  }, [open, loadContacts])

  async function handleSetPrimary(contactId: string) {
    try {
      const response = await fetch(`/api/jobs/${jobId}/contacts/set-primary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      })
      if (response.ok) {
        await loadContacts()
        onContactsChanged?.()
      }
    } catch {
      console.error('Failed to set primary')
    }
  }

  async function handleDelete(contactId: string) {
    if (!confirm('Delete this contact?')) return
    try {
      const response = await fetch(`/api/jobs/${jobId}/contacts/${contactId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await loadContacts()
        onContactsChanged?.()
      }
    } catch {
      console.error('Failed to delete contact')
    }
  }

  function handleContactAdded() {
    loadContacts()
    onContactsChanged?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contacts — {companyName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading contacts...</p>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">No contacts yet</p>
                <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add First Contact
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {contacts.map((contact) => {
                  const rate = responseRate(contact)
                  return (
                    <div
                      key={contact.id}
                      className={`p-3 rounded-lg border ${
                        contact.is_primary
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">
                              {contact.email}
                            </span>
                            {contact.is_primary && (
                              <Badge className="flex items-center gap-1 text-xs py-0 h-5">
                                <Star className="h-2.5 w-2.5 fill-current" />
                                Primary
                              </Badge>
                            )}
                          </div>

                          {(contact.contact_name || contact.contact_role) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {[contact.contact_name, contact.contact_role]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}

                          {contact.emails_sent > 0 && (
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1.5">
                              <span>{contact.emails_sent} sent</span>
                              <span>{contact.emails_opened} opened</span>
                              <span>{contact.emails_replied} replied</span>
                              {rate > 0 && (
                                <span className="flex items-center gap-0.5 text-green-600 font-medium">
                                  <TrendingUp className="h-3 w-3" />
                                  {rate.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          )}

                          {contact.notes && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              {contact.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1 shrink-0">
                          {!contact.is_primary && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Set as primary"
                              onClick={() => handleSetPrimary(contact.id)}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            title="Delete contact"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {contacts.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Contact
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddContactDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        jobId={jobId}
        companyName={companyName}
        onSuccess={handleContactAdded}
      />
    </>
  )
}
