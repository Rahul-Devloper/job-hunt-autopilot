import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { jobContactRepository, jobRepository } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'
import { markJobEmailFound } from '@/lib/utils/update-job-status'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await AuthService.authenticateCookie()

    const job = await jobRepository.findById(params.id, auth.userId)
    if (!job) return ApiResponseBuilder.notFound('Job not found')

    if (!job.poster_name && !job.poster_linkedin_url) {
      return ApiResponseBuilder.error('No poster information captured for this job.')
    }

    const companyDomain = ContactDiscoveryService.extractDomain(
      job.company_domain || job.company_name,
    )

    if (!companyDomain) {
      return ApiResponseBuilder.error(`Could not determine domain for ${job.company_name}`)
    }

    const supabase = await createClient()

    console.log(`[FindContacts] Poster lookup: ${job.poster_name ?? job.poster_linkedin_url}`)
    const posterContact = await ContactDiscoveryService.findPosterContact(
      job.poster_name ?? null,
      job.poster_title ?? null,
      job.poster_linkedin_url ?? null,
      companyDomain,
      auth.userId,
    )

    if (!posterContact) {
      return ApiResponseBuilder.error('No email found for job poster.')
    }

    // Clear existing poster contacts to avoid duplicates on re-run
    await supabase
      .from('job_contacts')
      .delete()
      .eq('job_id', job.id)
      .eq('user_id', auth.userId)
      .eq('contact_source', 'poster')

    const saved = await jobContactRepository.create({
      job_id: job.id,
      user_id: auth.userId,
      email: posterContact.email,
      contact_name: posterContact.name,
      contact_role: posterContact.title,
      contact_source: 'poster',
      is_primary: true,
      is_poster: true,
      notes: posterContact.linkedin_url || null,
    })

    // Set hr_email on the job so email badge + Send Email button appear
    await markJobEmailFound(
      supabase,
      job.id,
      auth.userId,
      job.status,
      posterContact.email,
      'hunter',
      'personal',
    )

    await supabase.from('contact_discovery_logs').insert({
      user_id: auth.userId,
      job_id: job.id,
      method: 'combined',
      contacts_found: 1,
      credits_used: 1,
      success: true,
      providers: [posterContact.source],
    })

    console.log(`[FindContacts] Poster found: ${posterContact.email}`)

    return ApiResponseBuilder.success(
      { contact: saved, email: posterContact.email },
      `✅ Found poster email: ${posterContact.email}!`,
    )
  } catch (error) {
    console.error('[FindContacts] Unexpected error:', error)
    return ApiResponseBuilder.fromError(error)
  }
}
