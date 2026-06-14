import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { createServiceClient } from '@/lib/supabase/server'

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

    // Domain-discovery-once: first profile gets verified domain via findByLinkedIn,
    // remaining profiles reuse that domain via fast findByName
    const contacts = await ContactDiscoveryService.findContactsForProfiles(
      profiles.slice(0, 6),
      job.company_domain || '',
      auth.userId,
    )

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
        console.error('[LinkedInContacts] Save error:', err)
      }
    }

    // Update job.company_domain with verified domain for future lookups
    if (contacts.length > 0) {
      const verifiedDomain = contacts[0].email.split('@')[1]
      if (verifiedDomain && verifiedDomain !== job.company_domain) {
        await supabase
          .from('jobs')
          .update({ company_domain: verifiedDomain })
          .eq('id', job.id)
          .eq('user_id', auth.userId)
        console.log(`[LinkedInContacts] Updated job domain to: ${verifiedDomain}`)
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
