import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ContactDiscoveryService } from '@/lib/services/contact-discovery-service'
import { jobContactRepository, jobRepository } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await AuthService.authenticateCookie()

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

    const companyDomain = ContactDiscoveryService.extractDomain(
      job.company_domain || job.company_name,
    )

    if (!companyDomain) {
      return ApiResponseBuilder.error(`Could not determine domain for ${job.company_name}`)
    }

    const savedContacts = []
    let discoveryMethod = 'domain'
    const providersUsed: string[] = []
    let totalCredits = 0

    // ── Step 1: Poster-specific lookup (Hunter email-finder) ──────────────────
    if (job.poster_name) {
      console.log(`[FindContacts] Trying poster lookup for: ${job.poster_name}`)
      try {
        const posterContact = await ContactDiscoveryService.findPosterContact(
          job,
          companyDomain,
          auth.userId,
        )

        if (posterContact) {
          console.log(`[FindContacts] Poster found: ${posterContact.email}`)
          const saved = await jobContactRepository.create({
            job_id: job.id,
            user_id: auth.userId,
            email: posterContact.email,
            contact_name: posterContact.name,
            contact_role: posterContact.title,
            contact_source: 'auto',
            is_primary: true,
            is_poster: true,
            notes: posterContact.linkedin_url || null,
          })
          savedContacts.push(saved)
          providersUsed.push('hunter')
          totalCredits += 1
          discoveryMethod = 'poster'
        }
      } catch (err) {
        console.error('[FindContacts] Poster lookup error (non-fatal):', err)
      }
    }

    // ── Step 2: Domain search for additional contacts ─────────────────────────
    const contactsNeeded = 4 - savedContacts.length
    if (contactsNeeded > 0) {
      console.log(`[FindContacts] Domain search — need ${contactsNeeded} more contacts`)
      const result = await ContactDiscoveryService.findContactsSmart(
        job.company_name,
        companyDomain,
        job.job_title,
        auth.userId,
      )

      if (result.contacts.length > 0) {
        // Deduplicate against poster contact (if any)
        const existingEmails = new Set(savedContacts.map((c) => c.email.toLowerCase()))
        const newContacts = result.contacts
          .filter((c) => !existingEmails.has(c.email.toLowerCase()))
          .slice(0, contactsNeeded)

        for (const contact of newContacts) {
          try {
            const isPrimary = savedContacts.length === 0
            const saved = await jobContactRepository.create({
              job_id: job.id,
              user_id: auth.userId,
              email: contact.email,
              contact_name: contact.name,
              contact_role: contact.title,
              contact_source: 'auto',
              is_primary: isPrimary,
              is_poster: false,
            })
            savedContacts.push(saved)
          } catch (err) {
            console.error('[FindContacts] Error saving contact:', err)
          }
        }

        totalCredits += result.creditsUsed
        for (const p of result.providers || []) {
          if (!providersUsed.includes(p)) providersUsed.push(p)
        }

        if (discoveryMethod === 'poster') {
          discoveryMethod = 'poster+domain'
        } else {
          discoveryMethod = result.method
        }
      }
    }

    if (savedContacts.length === 0) {
      return ApiResponseBuilder.error('No contacts found. Make sure API keys are configured in Settings.')
    }

    // Log discovery attempt
    await supabase.from('contact_discovery_logs').insert({
      user_id: auth.userId,
      job_id: job.id,
      method: discoveryMethod as 'apollo' | 'hunter' | 'manual' | 'combined' | null,
      contacts_found: savedContacts.length,
      credits_used: totalCredits,
      success: true,
      providers: providersUsed,
    })

    const providerText = providersUsed.length ? providersUsed.join(' + ') : discoveryMethod
    console.log(`[FindContacts] Done — ${savedContacts.length} contacts via ${providerText}`)

    return ApiResponseBuilder.success(
      {
        contacts: savedContacts,
        method: discoveryMethod,
        credits_used: totalCredits,
        providers: providersUsed,
      },
      `✅ Found ${savedContacts.length} contact${savedContacts.length !== 1 ? 's' : ''} via ${providerText}!`,
    )
  } catch (error) {
    console.error('[FindContacts] Unexpected error:', error)
    return ApiResponseBuilder.fromError(error)
  }
}
