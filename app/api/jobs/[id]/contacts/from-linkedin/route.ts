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

    // Use service client — bypasses RLS for extension Bearer token requests
    const supabase = createServiceClient()

    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', auth.userId)
      .single()

    if (!job) return ApiResponseBuilder.notFound('Job not found')

    console.log(`[LinkedInContacts] Processing ${profiles.length} profiles for job ${job.id}`)

    const LOOKUP_TIMEOUT_MS = 8000

    // Must be awaited — all lookups run in parallel, we wait for all
    const lookupResults = await Promise.allSettled(
      profiles.slice(0, 6).map(async (profile: LinkedInProfile) =>
        Promise.race([
          ContactDiscoveryService.findByNameDirect(
            profile.name,
            profile.title,
            profile.linkedin_url,
            job.company_domain || '',
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

    console.log('[LinkedInContacts] All lookups complete, processing results...')

    const savedContacts = []

    for (const result of lookupResults) {
      if (result.status === 'rejected') {
        console.error('[LinkedInContacts] Lookup rejected:', result.reason)
        continue
      }

      const contact = result.value
      console.log('[LinkedInContacts] Processing result:', contact?.email || 'null')
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
          console.log(`[LinkedInContacts] ✅ Saved: ${contact.name} (${contact.email})`)
        }
      } catch (err) {
        console.error('[LinkedInContacts] ❌ Save error:', err)
      }
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
