import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { createServiceClient } from '@/lib/supabase/server'

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

    // Use service client (bypasses RLS) — required for extension Bearer token requests
    const supabase = createServiceClient()

    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', auth.userId)
      .single()

    if (!job) return ApiResponseBuilder.notFound('Job not found')

    const companyDomain = ContactDiscoveryService.extractDomain(
      job.company_domain || job.company_name,
    )

    console.log(`[LinkedInContacts] Processing ${profiles.length} profiles for job ${job.id}`)

    const LOOKUP_TIMEOUT_MS = 15000

    const lookupResults = await Promise.allSettled(
      profiles.slice(0, 6).map((profile) =>
        Promise.race([
          ContactDiscoveryService.findPosterContact(
            profile.name,
            profile.title,
            profile.linkedin_url,
            companyDomain || '',
            auth.userId,
          ),
          new Promise<null>((resolve) =>
            setTimeout(() => {
              console.log(`[LinkedInContacts] Timeout: ${profile.name}`)
              resolve(null)
            }, LOOKUP_TIMEOUT_MS)
          ),
        ])
      )
    )

    const savedContacts = []
    for (const result of lookupResults) {
      if (result.status === 'rejected') {
        console.error('[LinkedInContacts] Lookup failed:', result.reason)
        continue
      }
      const contact = result.value
      if (!contact) continue

      try {
        const { data: saved }: { data: Record<string, unknown> | null } = await supabase
          .from('job_contacts')
          .insert({
            job_id: job.id,
            user_id: auth.userId,
            email: contact.email,
            contact_name: contact.name,
            contact_role: contact.title,
            contact_source: 'auto',
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
        console.error('[LinkedInContacts] Error saving contact:', err)
      }
    }

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
