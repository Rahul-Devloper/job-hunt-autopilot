import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { createServiceClient } from '@/lib/supabase/server'
import { updateJobStatusOnContactFound } from '@/lib/utils/update-job-status'

interface LinkedInProfile {
  name: string
  title: string | null
  linkedin_url: string | null
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Accept both cookie (web app) and Bearer token (extension)
    const authHeader = request.headers.get('Authorization')
    const auth = authHeader
      ? await AuthService.authenticateFromHeader(authHeader)
      : await AuthService.authenticateCookie()

    const { profiles, verified_domain }: { profiles: LinkedInProfile[]; verified_domain?: string | null } = await request.json()

    if (!profiles || profiles.length === 0) {
      return ApiResponseBuilder.badRequest('No profiles provided')
    }

    // Use service client — bypasses RLS for extension Bearer token requests
    const supabase = createServiceClient()

    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', auth.userId)
      .single()

    if (!job) return ApiResponseBuilder.notFound('Job not found')

    const domainToUse = verified_domain || job.company_domain || ''
    console.log(`[LinkedInContacts] Processing ${profiles.length} profiles for job ${job.id}`)
    console.log('[LinkedInContacts] Using domain:', domainToUse, verified_domain ? '(verified)' : '(fallback)')

    const contacts = await ContactDiscoveryService.findContactsForProfiles(
      profiles.slice(0, 6),
      domainToUse,
      auth.userId,
    )

    // Clear existing linkedin_people contacts for this job to avoid duplicates on re-run
    await supabase
      .from('job_contacts')
      .delete()
      .eq('job_id', job.id)
      .eq('user_id', auth.userId)
      .eq('contact_source', 'linkedin_people')
    console.log('[LinkedInContacts] Cleared old linkedin_people contacts')

    const savedContacts = []
    for (const contact of contacts) {
      try {
        const { data: saved }: { data: Record<string, unknown> | null } = await supabase
          .from('job_contacts')
          .insert({
            job_id: job.id,
            user_id: auth.userId,
            email: contact.email,
            contact_name: contact.name,
            contact_role: contact.title,
            contact_source: 'linkedin_people',
            is_primary: savedContacts.length === 0,
            is_poster: false,
          })
          .select()
          .single()

        if (saved) {
          savedContacts.push(saved)
          console.log(`[LinkedInContacts] Saved: ${contact.name} (${contact.email})`)
        }
      } catch (err) {
        console.error('[LinkedInContacts] Save error:', err)
      }
    }

    if (savedContacts.length > 0) {
      await updateJobStatusOnContactFound(supabase, job.id, auth.userId, job.status)
    }

    // Cache verified_domain (from /about/ page scrape) back to job if new
    if (verified_domain && verified_domain !== job.company_domain) {
      await supabase
        .from('jobs')
        .update({ company_domain: verified_domain })
        .eq('id', job.id)
        .eq('user_id', auth.userId)
      console.log(`[LinkedInContacts] Cached verified domain to job: ${verified_domain}`)
    }

    console.log('[LinkedInContacts] Final saved count:', savedContacts.length)

    await supabase.from('contact_discovery_logs').insert({
      user_id: auth.userId,
      job_id: job.id,
      method: 'combined',
      contacts_found: savedContacts.length,
      credits_used: savedContacts.length,
      success: savedContacts.length > 0,
      providers: ['getprospect', 'hunter'],
    })

    return ApiResponseBuilder.success(
      { contacts_saved: savedContacts.length, contacts: savedContacts },
      `✅ Found ${savedContacts.length} HR contact${savedContacts.length !== 1 ? 's' : ''}!`,
    )
  } catch (error) {
    console.error('[LinkedInContacts] Unexpected error:', error)
    return ApiResponseBuilder.fromError(error)
  }
}
