import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { jobContactRepository, jobRepository } from '@/lib/repositories'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await AuthService.authenticateCookie()

    const job = await jobRepository.findById(params.id, auth.userId)
    if (!job) {
      return ApiResponseBuilder.notFound('Job not found')
    }

    const companyDomain = ContactDiscoveryService.extractDomain(job.company_name)

    const result = await ContactDiscoveryService.findContactsSmart(
      job.company_name,
      companyDomain,
      job.job_title,
      auth.userId
    )

    if (!result.success && result.contacts.length === 0) {
      return ApiResponseBuilder.error(result.error || 'No contacts found', 'NOT_FOUND', 404)
    }

    const savedContacts = []
    for (const contact of result.contacts) {
      try {
        const saved = await jobContactRepository.create({
          job_id: job.id,
          user_id: auth.userId,
          email: contact.email,
          contact_name: contact.name,
          contact_role: contact.title,
          contact_source: 'auto',
          is_primary: savedContacts.length === 0,
        })
        savedContacts.push(saved)
      } catch (err) {
        console.error('Error saving contact:', err)
      }
    }

    const supabase = createServiceClient()
    await supabase.from('contact_discovery_logs').insert({
      user_id: auth.userId,
      job_id: job.id,
      method: result.method === 'multi' ? 'combined' : (result.method as 'apollo' | 'hunter' | 'manual' | 'combined'),
      contacts_found: savedContacts.length,
      credits_used: result.creditsUsed,
      success: result.success,
      providers: result.providers ?? [],
    })

    const providerText = result.providers?.length ? result.providers.join(' + ') : result.method

    return ApiResponseBuilder.success(
      {
        contacts: savedContacts,
        method: result.method,
        credits_used: result.creditsUsed,
        providers: result.providers,
      },
      `Found ${savedContacts.length} contact${savedContacts.length !== 1 ? 's' : ''} via ${providerText}!`
    )
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
