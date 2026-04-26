import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { jobContactRepository, jobRepository } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await AuthService.authenticateCookie()

    // Get job details
    const job = await jobRepository.findById(params.id, auth.userId)
    if (!job) {
      return ApiResponseBuilder.notFound('Job not found')
    }

    const supabase = await createClient()

    // Clear existing contacts for this job
    console.log(`[FindContacts] Clearing existing contacts for job ${job.id}`)
    const { error: deleteError } = await supabase
      .from('job_contacts')
      .delete()
      .eq('job_id', job.id)
      .eq('user_id', auth.userId)

    if (deleteError) {
      console.error('[FindContacts] Error deleting old contacts:', deleteError)
    }

    // Extract domain
    const companyDomain = ContactDiscoveryService.extractDomain(
      job.company_name,
    )

    // Find contacts using email finder providers
    console.log(`[FindContacts] Searching for contacts at ${companyDomain}`)
    const result = await ContactDiscoveryService.findContactsSmart(
      job.company_name,
      companyDomain,
      job.job_title,
      auth.userId,
    )

    if (!result.success) {
      console.log('[FindContacts] No contacts found:', result.error)
      return ApiResponseBuilder.error(result.error || 'No contacts found')
    }

    console.log(
      `[FindContacts] Found ${result.contacts.length} contacts via ${result.providers?.join(', ')}`,
    )

    // Save new contacts
    const savedContacts = []
    for (let i = 0; i < result.contacts.length; i++) {
      const contact = result.contacts[i]
      try {
        const saved = await jobContactRepository.create({
          job_id: job.id,
          user_id: auth.userId,
          email: contact.email,
          contact_name: contact.name,
          contact_role: contact.title,
          contact_source: 'auto',
          is_primary: i === 0, // First contact is primary
        })
        savedContacts.push(saved)
        console.log(
          `[FindContacts] Saved contact: ${contact.name} (${contact.email})`,
        )
      } catch (error) {
        console.error('[FindContacts] Error saving contact:', error)
        // Continue with other contacts even if one fails
      }
    }

    // Log discovery attempt
    await supabase.from('contact_discovery_logs').insert({
      user_id: auth.userId,
      job_id: job.id,
      method: result.method,
      contacts_found: savedContacts.length,
      credits_used: result.creditsUsed,
      success: result.success,
      providers: result.providers || [],
    })

    const providerText = result.providers?.length
      ? result.providers.join(' + ')
      : result.method

    console.log(
      `[FindContacts] Success! Saved ${savedContacts.length} contacts`,
    )

    return ApiResponseBuilder.success(
      {
        contacts: savedContacts,
        method: result.method,
        credits_used: result.creditsUsed,
        providers: result.providers,
      },
      `✅ Found ${savedContacts.length} contact${savedContacts.length !== 1 ? 's' : ''} via ${providerText}!`,
    )
  } catch (error) {
    console.error('[FindContacts] Unexpected error:', error)
    return ApiResponseBuilder.fromError(error)
  }
}