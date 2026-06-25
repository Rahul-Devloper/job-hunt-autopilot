import type { SupabaseClient } from '@supabase/supabase-js'

export async function updateJobStatusOnContactFound(
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
