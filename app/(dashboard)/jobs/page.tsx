'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/header'
import { KanbanBoard } from '@/components/dashboard/kanban-board'
import { ListView } from '@/components/dashboard/list-view'
import { ManualEmailDialog } from '@/components/dashboard/manual-email-dialog'
import { EmailComposer } from '@/components/dashboard/email-composer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { Job } from '@/types'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [findingEmail, setFindingEmail] = useState<string | null>(null)
  const [manualEmailDialog, setManualEmailDialog] = useState<{
    open: boolean
    jobId: string
    companyName: string
  } | null>(null)
  const [emailComposer, setEmailComposer] = useState<Job | null>(null)

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('jobs') as any)
        .select('*')
        .order('created_at', { ascending: false }) as { data: Job[] | null; error: unknown }

      if (error) throw error
      setJobs(data || [])
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const query = searchQuery.toLowerCase()
    return (
      job.company_name.toLowerCase().includes(query) ||
      job.job_title.toLowerCase().includes(query) ||
      job.location?.toLowerCase().includes(query)
    )
  })

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this job?')) return

    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('jobs') as any).delete().eq('id', id) as { error: unknown }
      if (error) throw error
      setJobs(jobs.filter((job) => job.id !== id))
    } catch (error) {
      console.error('Error deleting job:', error)
      alert('Failed to delete job')
    }
  }

  async function handleFindEmail(id: string) {
    const job = jobs.find((j) => j.id === id)
    if (!job) return

    if (!job.company_domain) {
      alert('Company domain missing. Cannot find email.')
      return
    }

    setFindingEmail(id)

    try {
      const response = await fetch('/api/emails/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: id,
          company_domain: job.company_domain,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`Email found via ${data.source}!\n\nEmail: ${data.email}`)
        await fetchJobs()
      } else {
        const addManually = confirm(
          `${data.message}\n\nWould you like to add the email manually?`
        )
        if (addManually) {
          setManualEmailDialog({
            open: true,
            jobId: id,
            companyName: job.company_name,
          })
        }
      }
    } catch (error) {
      console.error('Error finding email:', error)
      alert('Failed to find email. Please try again.')
    } finally {
      setFindingEmail(null)
    }
  }

  function handleSendEmail(id: string) {
    const job = jobs.find((j) => j.id === id)
    if (!job) return
    if (!job.hr_email) {
      alert('No email found for this job. Find an email first.')
      return
    }
    setEmailComposer(job)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Loading jobs...</p>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col">
      <Header
        title="Jobs"
        description={`${jobs.length} total job${jobs.length !== 1 ? 's' : ''} captured`}
        showSearch
        onSearch={setSearchQuery}
      />

      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="kanban" className="h-full flex flex-col">
          <div className="border-b bg-white px-8">
            <TabsList className="h-auto p-0 bg-transparent gap-0">
              <TabsTrigger
                value="kanban"
                className="rounded-none border-b-2 border-transparent data-active:border-gray-900 data-active:bg-transparent pb-3 pt-2"
              >
                Kanban Board
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="rounded-none border-b-2 border-transparent data-active:border-gray-900 data-active:bg-transparent pb-3 pt-2"
              >
                List View
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="kanban" className="m-0 flex-1">
            {filteredJobs.length === 0 ? (
              <div className="flex h-full items-center justify-center py-24">
                <div className="text-center">
                  <p className="text-gray-500 font-medium">
                    {searchQuery ? 'No jobs match your search' : 'No jobs captured yet'}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    Use the Chrome extension to capture jobs from LinkedIn!
                  </p>
                </div>
              </div>
            ) : (
              <KanbanBoard
                jobs={filteredJobs}
                onDelete={handleDelete}
                onFindEmail={handleFindEmail}
                onSendEmail={handleSendEmail}
                findingEmail={findingEmail}
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="m-0 flex-1">
            <ListView
              jobs={filteredJobs}
              onDelete={handleDelete}
              onFindEmail={handleFindEmail}
              onSendEmail={handleSendEmail}
              findingEmail={findingEmail}
            />
          </TabsContent>
        </Tabs>
      </div>

      {manualEmailDialog && (
        <ManualEmailDialog
          open={manualEmailDialog.open}
          onClose={() => setManualEmailDialog(null)}
          jobId={manualEmailDialog.jobId}
          companyName={manualEmailDialog.companyName}
          onSuccess={fetchJobs}
        />
      )}

      {emailComposer && (
        <EmailComposer
          open={!!emailComposer}
          onClose={() => setEmailComposer(null)}
          job={emailComposer}
          onSuccess={() => {
            fetchJobs()
            setEmailComposer(null)
          }}
        />
      )}
    </div>
  )
}
