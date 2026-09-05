'use client'

import { useState, type ComponentProps, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { JobCard, statusColors, statusLabels } from './job-card'
import { cn } from '@/lib/utils'
import type { Job, JobStatus } from '@/types'

interface KanbanBoardProps {
  jobs: Job[]
  onDelete?: (id: string) => void
  onFindEmail?: (id: string) => void
  onSendEmail?: (id: string) => void
  onManualEmail?: (id: string, existingEmail?: string) => void
  onRemoveEmail?: (id: string) => void
  onStatusChange?: (id: string, status: JobStatus) => void
  findingEmail?: string | null
  onRefresh?: () => void
}

const columns: { status: JobStatus; label: string; color: string }[] = [
  { status: 'captured', label: 'Captured', color: 'bg-gray-200' },
  { status: 'email_found', label: 'Email Found', color: 'bg-blue-200' },
  { status: 'email_sent', label: 'Email Sent', color: 'bg-purple-200' },
  { status: 'interview', label: 'Interview', color: 'bg-yellow-200' },
  { status: 'offer', label: 'Offer', color: 'bg-green-200' },
  { status: 'rejected', label: 'Rejected', color: 'bg-red-200' },
]

function DraggableJobCard(props: ComponentProps<typeof JobCard>) {
  // DragOverlay renders the floating clone that follows the cursor, so the
  // original stays put in the column — only dimmed. Do NOT also apply
  // `transform` here, or the original would move too and visually clash
  // with the overlay clone tracking the cursor.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.job.id,
    data: { status: props.job.status },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('touch-none', isDragging && 'opacity-40')}
    >
      <JobCard {...props} />
    </div>
  )
}

function DroppableColumn({
  status,
  children,
}: {
  status: JobStatus
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-3 min-h-[80px] rounded-lg p-1 -m-1 transition-colors',
        isOver && 'bg-blue-50 ring-2 ring-blue-300'
      )}
    >
      {children}
    </div>
  )
}

function DragPreviewCard({ job }: { job: Job }) {
  return (
    <div className="w-72 rounded-lg border bg-white p-4 shadow-lg scale-105 rotate-1">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
          {job.company_name.substring(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.company_name}</h3>
        </div>
      </div>
      <h4 className="mt-3 text-sm font-medium text-gray-900 line-clamp-2">{job.job_title}</h4>
      <span
        className={cn(
          'mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
          statusColors[job.status]
        )}
      >
        {statusLabels[job.status]}
      </span>
    </div>
  )
}

export function KanbanBoard({ jobs, onDelete, onFindEmail, onSendEmail, onManualEmail, onRemoveEmail, onStatusChange, findingEmail, onRefresh }: KanbanBoardProps) {
  const [activeJob, setActiveJob] = useState<Job | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find((j) => j.id === event.active.id)
    setActiveJob(job ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveJob(null)

    if (!over) return // dropped outside any column — snap back

    const job = jobs.find((j) => j.id === active.id)
    const newStatus = over.id as JobStatus
    if (!job || job.status === newStatus) return // same column — snap back

    onStatusChange?.(job.id, newStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveJob(null)}
    >
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

              <DroppableColumn status={column.status}>
                {columnJobs.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    No jobs yet
                  </div>
                ) : (
                  columnJobs.map((job) => (
                    <DraggableJobCard
                      key={job.id}
                      job={job}
                      onDelete={onDelete}
                      onFindEmail={onFindEmail}
                      onSendEmail={onSendEmail}
                      onManualEmail={onManualEmail}
                      onRemoveEmail={onRemoveEmail}
                      onStatusChange={onStatusChange}
                      findingEmail={findingEmail}
                      onRefresh={onRefresh}
                    />
                  ))
                )}
              </DroppableColumn>
            </div>
          )
        })}
      </div>

      <DragOverlay>{activeJob && <DragPreviewCard job={activeJob} />}</DragOverlay>
    </DndContext>
  )
}
