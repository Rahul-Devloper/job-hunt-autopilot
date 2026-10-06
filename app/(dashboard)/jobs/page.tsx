'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/header'
import { KanbanBoard } from '@/components/dashboard/kanban-board'
import { ListView } from '@/components/dashboard/list-view'
import { EmailComposer } from '@/components/dashboard/email-composer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { BoardJob, Job, JobStatus } from '@/types'

export default function JobsPage() {
  const [jobs, setJobs] = useState<BoardJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [emailComposer, setEmailComposer] = useState<Job | null>(null)

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('jobs') as any)
        .select('*, job_contacts(count)')
        .order('created_at', { ascending: false }) as {
          data: (Job & { job_contacts?: { count: number }[] })[] | null
          error: unknown
        }

      if (error) throw error
      setJobs(
        (data || []).map(({ job_contacts, ...job }) => ({
          ...job,
          contact_count: job_contacts?.[0]?.count ?? 0,
        }))
      )
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

  function handleSendEmail(id: string) {
    const job = jobs.find((j) => j.id === id)
    if (!job) return
    setEmailComposer(job)
  }

  async function handleStatusChange(id: string, newStatus: JobStatus) {
    const previousJobs = jobs
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, status: newStatus } : job))
    )

    try {
      const response = await fetch(`/api/jobs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      setJobs(previousJobs)
      alert('Failed to update status. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading jobs...</p>
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

      <div className="flex-1 overflow-hidden min-h-0">
        <Tabs defaultValue="kanban" className="h-full flex flex-col">
          <div className="shrink-0 border-b bg-background px-8">
            <TabsList className="h-auto p-0 bg-transparent gap-0">
              <TabsTrigger
                value="kanban"
                className="rounded-none border-b-2 border-transparent data-active:border-foreground data-active:bg-transparent pb-3 pt-2"
              >
                Kanban Board
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="rounded-none border-b-2 border-transparent data-active:border-foreground data-active:bg-transparent pb-3 pt-2"
              >
                List View
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="kanban" className="m-0 flex-1 min-h-0 overflow-hidden">
            {filteredJobs.length === 0 ? (
              <div className="flex h-full items-center justify-center py-24">
                <div className="text-center">
                  <p className="text-muted-foreground font-medium">
                    {searchQuery ? 'No jobs match your search' : 'No jobs captured yet'}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground/70">
                    Use the Chrome extension to capture jobs from LinkedIn!
                  </p>
                </div>
              </div>
            ) : (
              <KanbanBoard
                jobs={filteredJobs}
                onDelete={handleDelete}
                onSendEmail={handleSendEmail}
                onStatusChange={handleStatusChange}
                onRefresh={fetchJobs}
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="m-0 flex-1 min-h-0 overflow-hidden">
            <ListView
              jobs={filteredJobs}
              onDelete={handleDelete}
              onSendEmail={handleSendEmail}
              onRefresh={fetchJobs}
            />
          </TabsContent>
        </Tabs>
      </div>

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
