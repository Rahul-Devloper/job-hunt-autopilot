import type { SupabaseClient } from '@supabase/supabase-js'

async function updateJobStatusOnContactFound(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  currentStatus: string,
): Promise<void> {
  if (currentStatus === 'captured') {
    await supabase
      .from('jobs')
      .update({ status: 'email_found' })
      .eq('id', jobId)
      .eq('user_id', userId)
    console.log(`[JobStatus] Job ${jobId} → email_found`)
  }
}

/**
 * Set jobs.hr_email (+ source/type) from a discovered contact, then move
 * status captured → email_found. Shared by every contact-discovery route
 * so the Send Email button (which only checks hr_email) and the kanban
 * column (which only checks status) never fall out of sync.
 */
export async function markJobEmailFound(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  currentStatus: string,
  email: string,
  emailSource: 'hunter' | 'community' | 'pattern' | 'apollo' | 'manual',
  emailType: 'personal' | 'generic',
): Promise<void> {
  await supabase
    .from('jobs')
    .update({
      hr_email: email,
      email_source: emailSource,
      email_type: emailType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('user_id', userId)

  await updateJobStatusOnContactFound(supabase, jobId, userId, currentStatus)
}
