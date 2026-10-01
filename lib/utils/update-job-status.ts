import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Re-derive a job's pipeline position from its job_contacts rows — the same
 * rows the Contacts popup shows. Call after every write that adds or removes
 * contacts (popup add/delete, LinkedIn extraction) so the kanban column never
 * depends on which path added the contact.
 *
 * Only moves between captured and email_found: a job that is already
 * email_sent / interview / offer / rejected has real history and is never
 * pulled backwards by a contact change.
 */
export async function syncJobStatusWithContacts(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
): Promise<void> {
  const { data: job } = await supabase
    .from('jobs')
    .select('status')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()
  if (!job) return

  const { count } = await supabase
    .from('job_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('user_id', userId)
  const hasContacts = (count ?? 0) > 0

  let next: string | null = null
  if (hasContacts && job.status === 'captured') next = 'email_found'
  if (!hasContacts && job.status === 'email_found') next = 'captured'
  if (!next) return

  await supabase
    .from('jobs')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('user_id', userId)
  console.log(`[JobStatus] Job ${jobId} → ${next}`)
}
