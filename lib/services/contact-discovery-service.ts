import { EmailFinderRepository } from '@/lib/repositories/email-finder-repository'
import { getAdapter } from '@/lib/email-finders/adapters'
import type { EmailFinderProvider } from '@/types/email-finders'

export interface Contact {
  name: string
  email: string
  title: string
  source: EmailFinderProvider
  confidence: 'high' | 'medium' | 'low'
  linkedin_url?: string
}

export class ContactDiscoveryService {
  /**
   * Look up the job poster's email.
   * Strategy 1: LinkedIn URL lookup (most accurate — tries all providers with findByLinkedIn).
   * Strategy 2: Name + domain lookup (fallback — tries all providers with findByName).
   */
  static async findPosterContact(
    posterName: string | null,
    posterTitle: string | null,
    posterLinkedInUrl: string | null,
    companyDomain: string,
    userId: string,
  ): Promise<Contact | null> {
    try {
      const providers = await EmailFinderRepository.getActiveProviders(userId)

      type AdapterWithLinkedIn = {
        findByLinkedIn: (url: string, token: string, title?: string | null) => Promise<Contact | null>
      }
      type AdapterWithName = {
        findByName: (first: string, last: string, domain: string, token: string, title?: string | null, linkedinUrl?: string | null) => Promise<Contact | null>
      }

      // Strategy 1: LinkedIn URL lookup
      if (posterLinkedInUrl) {
        for (const { provider } of providers) {
          try {
            const adapter = getAdapter(provider)
            if (typeof (adapter as unknown as AdapterWithLinkedIn).findByLinkedIn !== 'function') continue

            const token = await EmailFinderRepository.getValidToken(userId, provider)
            if (!token) continue

            console.log(`[ContactDiscovery] Trying LinkedIn URL lookup via ${provider}`)
            const contact = await (adapter as unknown as AdapterWithLinkedIn).findByLinkedIn(posterLinkedInUrl, token, posterTitle)

            if (contact) {
              console.log(`[ContactDiscovery] LinkedIn lookup success via ${provider}:`, contact.email)
              return contact
            }
          } catch (err) {
            console.error(`[ContactDiscovery] findByLinkedIn error for ${provider}:`, err)
          }
        }
      }

      // Strategy 2: Name + domain lookup
      // Skip if domain looks auto-generated from LinkedIn slug — likely wrong TLD/domain
      const domainLooksGenerated =
        companyDomain.includes('-ltd') ||
        companyDomain.includes('-inc') ||
        companyDomain.includes('-corp') ||
        companyDomain.includes('-online') ||
        companyDomain.includes('-uk')

      if (domainLooksGenerated) {
        console.log('[ContactDiscovery] Domain looks auto-generated, skipping name lookup:', companyDomain)
        return null
      }

      if (posterName) {
        const parts = posterName.trim().split(/\s+/)
        if (parts.length >= 2) {
          const firstName = parts[0]
          const lastName = parts.slice(1).join(' ')

          for (const { provider } of providers) {
            try {
              const adapter = getAdapter(provider)
              if (typeof (adapter as unknown as AdapterWithName).findByName !== 'function') continue

              const token = await EmailFinderRepository.getValidToken(userId, provider)
              if (!token) continue

              console.log(`[ContactDiscovery] Trying name lookup via ${provider}`)
              const contact = await (adapter as unknown as AdapterWithName).findByName(firstName, lastName, companyDomain, token, posterTitle, posterLinkedInUrl)

              if (contact) {
                console.log(`[ContactDiscovery] Name lookup success via ${provider}:`, contact.email)
                return contact
              }
            } catch (err) {
              console.error(`[ContactDiscovery] findByName error for ${provider}:`, err)
            }
          }
        }
      }

      console.log('[ContactDiscovery] All poster lookup strategies exhausted — no contact found')
      return null
    } catch (err) {
      console.error('[ContactDiscovery] findPosterContact error:', err)
      return null
    }
  }

  /**
   * Batch lookup for LinkedIn people page profiles.
   * All profiles run in parallel via findByName using the provided verified domain.
   */
  static async findContactsForProfiles(
    profiles: Array<{ name: string; title: string | null; linkedin_url: string | null }>,
    domain: string,
    userId: string,
  ): Promise<Contact[]> {
    const providers = await EmailFinderRepository.getActiveProviders(userId)
    console.log('[BatchLookup] Looking up', profiles.length, 'profiles using domain:', domain)

    type AdapterWithName = {
      findByName: (first: string, last: string, domain: string, token: string, title?: string | null, linkedinUrl?: string | null) => Promise<Contact | null>
    }

    const lookupProfile = async (profile: { name: string; title: string | null; linkedin_url: string | null }): Promise<Contact | null> => {
      const nameParts = profile.name.trim().split(/\s+/)
      if (nameParts.length < 2) return null

      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')

      for (const { provider } of providers) {
        try {
          const adapter = getAdapter(provider)
          if (typeof (adapter as unknown as AdapterWithName).findByName !== 'function') continue

          const token = await EmailFinderRepository.getValidToken(userId, provider)
          if (!token) continue

          console.log(`[BatchLookup] findByName: ${profile.name} @ ${domain} via ${provider}`)
          const contact = await (adapter as unknown as AdapterWithName).findByName(
            firstName,
            lastName,
            domain,
            token,
            profile.title,
            profile.linkedin_url,
          )

          if (contact) return contact
        } catch (err) {
          console.error(`[BatchLookup] findByName error for ${provider}:`, err)
        }
      }
      return null
    }

    const settled = await Promise.allSettled(profiles.map(lookupProfile))
    const results = settled
      .filter((r): r is PromiseFulfilledResult<Contact> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value)

    console.log('[BatchLookup] Total contacts found:', results.length)
    return results
  }

  static extractDomain(companyNameOrUrl: string): string | null {
    try {
      if (companyNameOrUrl.includes('http') || companyNameOrUrl.includes('.com')) {
        const url = new URL(
          companyNameOrUrl.startsWith('http') ? companyNameOrUrl : `https://${companyNameOrUrl}`
        )
        return url.hostname.replace('www.', '')
      }
      return `${companyNameOrUrl.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    } catch {
      return null
    }
  }
}
