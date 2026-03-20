'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/header'
import { KanbanBoard } from '@/components/dashboard/kanban-board'
import { ListView } from '@/components/dashboard/list-view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { Job } from '@/types'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

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
      const { error } = await supabase.from('jobs').delete().eq('id', id)
      if (error) throw error
      setJobs(jobs.filter((job) => job.id !== id))
    } catch (error) {
      console.error('Error deleting job:', error)
      alert('Failed to delete job')
    }
  }

  function handleFindEmail(id: string) {
    alert('Email finding coming in Session 5!')
  }

  function handleSendEmail(id: string) {
    alert('Email sending coming in Session 6!')
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
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent pb-3 pt-2"
              >
                Kanban Board
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent pb-3 pt-2"
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
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="m-0 flex-1">
            <ListView
              jobs={filteredJobs}
              onDelete={handleDelete}
              onFindEmail={handleFindEmail}
              onSendEmail={handleSendEmail}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
