'use client'

import { JobCard } from './job-card'
import type { Job, JobStatus } from '@/types'

interface KanbanBoardProps {
  jobs: Job[]
  onDelete?: (id: string) => void
  onFindEmail?: (id: string) => void
  onSendEmail?: (id: string) => void
  findingEmail?: string | null
}

const columns: { status: JobStatus; label: string; color: string }[] = [
  { status: 'captured', label: 'Captured', color: 'bg-gray-200' },
  { status: 'email_found', label: 'Email Found', color: 'bg-blue-200' },
  { status: 'email_sent', label: 'Email Sent', color: 'bg-purple-200' },
  { status: 'interview', label: 'Interview', color: 'bg-yellow-200' },
  { status: 'offer', label: 'Offer', color: 'bg-green-200' },
  { status: 'rejected', label: 'Rejected', color: 'bg-red-200' },
]

export function KanbanBoard({ jobs, onDelete, onFindEmail, onSendEmail, findingEmail }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 p-8 overflow-x-auto min-h-full">
      {columns.map((column) => {
        const columnJobs = jobs.filter((job) => job.status === column.status)

        return (
          <div key={column.status} className="flex flex-col w-72 shrink-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{column.label}</h3>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-gray-700 ${column.color}`}>
                {columnJobs.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {columnJobs.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                  No jobs yet
                </div>
              ) : (
                columnJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onDelete={onDelete}
                    onFindEmail={onFindEmail}
                    onSendEmail={onSendEmail}
                    findingEmail={findingEmail}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
