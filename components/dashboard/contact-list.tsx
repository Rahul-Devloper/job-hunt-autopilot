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
import { Mail, Star, Trash2, Plus, TrendingUp, ExternalLink, Pin } from 'lucide-react'
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

  const loadContacts = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!quiet) setLoading(true)
      try {
        const response = await fetch(`/api/jobs/${jobId}/contacts`)
        const data = await response.json()
        if (data.success) setContacts(data.data || [])
      } catch {
        console.error('Failed to load contacts')
      } finally {
        setLoading(false)
      }
    },
    [jobId]
  )

  useEffect(() => {
    if (open) loadContacts()
  }, [open, loadContacts])

  // The "Find LinkedIn HR Contacts" flow opens this dialog right away and
  // sends the user off to a LinkedIn tab; the extension writes the scraped
  // contacts to the backend while this tab is backgrounded. Without this,
  // the dialog would keep showing its initial (empty) fetch until it was
  // manually closed and reopened. Re-fetch whenever the dashboard tab
  // regains focus so the already-open dialog reflects what was just saved.
  useEffect(() => {
    if (!open) return
    function refetchOnReturn() {
      if (!document.hidden) loadContacts({ quiet: true })
    }
    document.addEventListener('visibilitychange', refetchOnReturn)
    window.addEventListener('focus', refetchOnReturn)
    return () => {
      document.removeEventListener('visibilitychange', refetchOnReturn)
      window.removeEventListener('focus', refetchOnReturn)
    }
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
              <p className="text-sm text-muted-foreground text-center py-4">Loading contacts...</p>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                <Mail className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No contacts yet</p>
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
                        contact.is_poster
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                          : contact.is_primary
                            ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10'
                            : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">
                              {contact.email}
                            </span>
                            {contact.is_poster && (
                              <Badge className="flex items-center gap-1 text-xs py-0 h-5 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/20">
                                <Pin className="h-2.5 w-2.5 fill-current" />
                                Job Poster
                              </Badge>
                            )}
                            {contact.is_primary && !contact.is_poster && (
                              <Badge className="flex items-center gap-1 text-xs py-0 h-5">
                                <Star className="h-2.5 w-2.5 fill-current" />
                                Primary
                              </Badge>
                            )}
                            {contact.is_primary && contact.is_poster && (
                              <Badge variant="outline" className="flex items-center gap-1 text-xs py-0 h-5 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-500/40">
                                <Star className="h-2.5 w-2.5" />
                                Primary
                              </Badge>
                            )}
                          </div>

                          {(contact.contact_name || contact.contact_role) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[contact.contact_name, contact.contact_role]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}

                          {contact.is_poster && contact.notes && contact.notes.startsWith('http') && (
                            <a
                              href={contact.notes}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                            >
                              <ExternalLink className="h-3 w-3" />
                              LinkedIn Profile
                            </a>
                          )}

                          {contact.emails_sent > 0 && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                              <span>{contact.emails_sent} sent</span>
                              <span>{contact.emails_opened} opened</span>
                              <span>{contact.emails_replied} replied</span>
                              {rate > 0 && (
                                <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 font-medium">
                                  <TrendingUp className="h-3 w-3" />
                                  {rate.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          )}

                          {contact.notes && !contact.is_poster && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
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
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 dark:hover:text-red-400"
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
