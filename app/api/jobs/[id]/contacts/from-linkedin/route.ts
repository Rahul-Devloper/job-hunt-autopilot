import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { jobRepository, jobContactRepository } from '@/lib/repositories'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { createClient } from '@/lib/supabase/server'

interface LinkedInProfile {
  name: string
  title: string
  linkedin_url: string
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
    const { profiles }: { profiles: LinkedInProfile[] } = await request.json()

    if (!profiles || profiles.length === 0) {
      return ApiResponseBuilder.badRequest('No profiles provided')
    }

    const job = await jobRepository.findById(params.id, auth.userId)
    if (!job) return ApiResponseBuilder.notFound('Job not found')

    const companyDomain = ContactDiscoveryService.extractDomain(
      job.company_domain || job.company_name,
    )

    console.log(`[LinkedInContacts] Processing ${profiles.length} profiles for job ${job.id}`)

    const savedContacts = []

    for (const profile of profiles.slice(0, 6)) {
      try {
        const contact = await ContactDiscoveryService.findPosterContact(
          profile.name,
          profile.title,
          profile.linkedin_url,
          companyDomain || '',
          auth.userId,
        )

        if (contact) {
          const saved = await jobContactRepository.create({
            job_id: job.id,
            user_id: auth.userId,
            email: contact.email,
            contact_name: contact.name,
            contact_role: contact.title,
            contact_source: 'auto',
            is_primary: savedContacts.length === 0,
            is_poster: false,
          })
          savedContacts.push(saved)
          console.log(`[LinkedInContacts] Saved: ${contact.name} (${contact.email})`)
        }
      } catch (err) {
        console.error('[LinkedInContacts] Error processing profile:', err)
      }
    }

    const supabase = await createClient()
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
    console.error('[LinkedInContacts] Error:', error)
    return ApiResponseBuilder.fromError(error)
  }
}
