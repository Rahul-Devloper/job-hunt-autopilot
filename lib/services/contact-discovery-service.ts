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

export interface ContactDiscoveryResult {
  contacts: Contact[]
  method: string
  creditsUsed: number
  success: boolean
  error?: string
  providers?: string[]
}

export class ContactDiscoveryService {
  /**
   * Smart multi-provider contact discovery.
   * Tries providers in priority order (Snov → GetProspect → Hunter) until 4 contacts found.
   * Each provider uses its adapter for searching; tokens are auto-refreshed as needed.
   */
  static async findContactsSmart(
    companyName: string,
    companyDomain: string | null,
    jobTitle: string,
    userId: string
  ): Promise<ContactDiscoveryResult> {
    try {
      const providers = await EmailFinderRepository.getActiveProviders(userId)

      if (providers.length === 0) {
        return {
          contacts: [],
          method: 'none',
          creditsUsed: 0,
          success: false,
          error: 'No email finder providers connected. Add API keys in Settings.',
        }
      }

      const domain = companyDomain || this.extractDomain(companyName)
      if (!domain) {
        return {
          contacts: [],
          method: 'none',
          creditsUsed: 0,
          success: false,
          error: `Could not determine domain for ${companyName}`,
        }
      }

      const allContacts: Contact[] = []
      let totalCredits = 0
      const providersUsed: string[] = []

      for (const { provider } of providers) {
        if (allContacts.length >= 4) break

        try {
          const adapter = getAdapter(provider)

          // Get valid token (auto-refreshes OAuth tokens when near-expiry)
          const token = await EmailFinderRepository.getValidToken(userId, provider)
          if (!token) {
            console.warn(`No valid token for ${provider}, skipping`)
            continue
          }

          const contacts = await adapter.searchByDomain(domain, token)

          if (contacts.length > 0) {
            const existingEmails = new Set(allContacts.map((c) => c.email.toLowerCase()))
            const newContacts = contacts.filter(
              (c) => !existingEmails.has(c.email.toLowerCase())
            )
            allContacts.push(...newContacts)

            const creditsUsed = adapter.getCreditsUsed(contacts)
            totalCredits += creditsUsed
            providersUsed.push(provider)

            await EmailFinderRepository.updateCredits(userId, provider, creditsUsed)
          }
        } catch (err) {
          console.error(`${provider} error:`, err)
          await EmailFinderRepository.setError(
            userId,
            provider,
            err instanceof Error ? err.message : 'Unknown error'
          )
        }
      }

      // Score and limit to top 4
      const finalContacts = allContacts
        .map((c) => ({ ...c, _score: this.scoreContact(c.title, jobTitle) }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 4)
        .map((c) => ({ name: c.name, email: c.email, title: c.title, source: c.source, confidence: c.confidence, linkedin_url: c.linkedin_url }) as Contact)

      return {
        contacts: finalContacts,
        method: providersUsed.length > 1 ? 'multi' : (providersUsed[0] ?? 'none'),
        creditsUsed: totalCredits,
        success: finalContacts.length > 0,
        providers: providersUsed,
        error: finalContacts.length === 0 ? 'No contacts found at this domain' : undefined,
      }
    } catch (err) {
      console.error('Contact discovery error:', err)
      return {
        contacts: [],
        method: 'error',
        creditsUsed: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  private static scoreContact(contactTitle: string, jobTitle: string): number {
    const t = contactTitle.toLowerCase()
    const j = jobTitle.toLowerCase()
    let score = 0

    if (t.includes('recruit')) score += 50
    if (t.includes('talent')) score += 45
    if (t.includes('hiring')) score += 45
    if (t.includes('hr')) score += 40
    if (t.includes('people')) score += 35
    if (t.includes('manager')) score += 30
    if (t.includes('director')) score += 35
    if (t.includes('head')) score += 35
    if (t.includes('vp') || t.includes('vice president')) score += 40
    if (t.includes('chief') || t.includes('cto') || t.includes('ceo')) score += 45

    if (j.includes('engineer') && t.includes('engineering')) score += 25
    if (j.includes('marketing') && t.includes('marketing')) score += 25
    if (j.includes('sales') && t.includes('sales')) score += 25
    if (j.includes('product') && t.includes('product')) score += 25

    return score
  }

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
   * Direct name + domain lookup — skips the slow LinkedIn insight API.
   * Fastest path: GetProspect/Hunter findByName using job.company_domain directly.
   */
  static async findByNameDirect(
    name: string,
    title: string | null,
    linkedinUrl: string | null,
    companyDomain: string,
    userId: string,
  ): Promise<Contact | null> {
    try {
      const nameParts = name.trim().split(/\s+/)
      if (nameParts.length < 2) {
        console.log('[findByNameDirect] Name has less than 2 parts — skipping:', name)
        return null
      }

      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')

      console.log('[findByNameDirect] Getting providers for user:', userId)
      const providers = await EmailFinderRepository.getActiveProviders(userId)
      console.log('[findByNameDirect] Active providers:', providers.map((p) => p.provider))

      type AdapterWithName = {
        findByName: (first: string, last: string, domain: string, token: string, title?: string | null, linkedinUrl?: string | null) => Promise<Contact | null>
      }

      for (const { provider } of providers) {
        console.log('[findByNameDirect] Trying provider:', provider)

        const adapter = getAdapter(provider)
        const token = await EmailFinderRepository.getValidToken(userId, provider)
        console.log('[findByNameDirect] Token exists:', !!token, 'for', provider)

        if (!token) {
          console.log('[findByNameDirect] No token — skipping', provider)
          continue
        }

        if (typeof (adapter as unknown as AdapterWithName).findByName !== 'function') {
          console.log('[findByNameDirect] No findByName method — skipping', provider)
          continue
        }

        console.log(`[findByNameDirect] Calling findByName: ${name} @ ${companyDomain} via ${provider}`)

        const contact = await (adapter as unknown as AdapterWithName).findByName(
          firstName,
          lastName,
          companyDomain,
          token,
          title,
          linkedinUrl,
        )

        console.log(`[findByNameDirect] Result from ${provider}:`, contact?.email || 'null')

        if (contact) return contact
      }

      console.log('[findByNameDirect] All providers exhausted — no contact found')
      return null
    } catch (err) {
      console.error('[findByNameDirect] Error:', err)
      return null
    }
  }

  /**
   * Batch lookup for LinkedIn people page profiles.
   * Discovers the verified company domain ONCE via the first findByLinkedIn,
   * then reuses it for all remaining profiles via fast findByName.
   */
  static async findContactsForProfiles(
    profiles: Array<{ name: string; title: string | null; linkedin_url: string | null }>,
    fallbackDomain: string,
    userId: string,
  ): Promise<Contact[]> {
    const providers = await EmailFinderRepository.getActiveProviders(userId)
    const results: Contact[] = []
    let verifiedDomain: string | null = null

    type AdapterWithLinkedIn = {
      findByLinkedIn: (url: string, token: string, title?: string | null) => Promise<Contact | null>
    }
    type AdapterWithName = {
      findByName: (first: string, last: string, domain: string, token: string, title?: string | null, linkedinUrl?: string | null) => Promise<Contact | null>
    }

    const gpProvider = providers.find((p) => p.provider === 'getprospect')

    // STEP 1: First profile via findByLinkedIn to discover verified domain
    if (gpProvider && profiles.length > 0 && profiles[0].linkedin_url) {
      try {
        const adapter = getAdapter('getprospect')
        const token = await EmailFinderRepository.getValidToken(userId, 'getprospect')

        if (token && typeof (adapter as unknown as AdapterWithLinkedIn).findByLinkedIn === 'function') {
          console.log('[BatchLookup] Discovering domain via first profile:', profiles[0].name)
          const contact = await (adapter as unknown as AdapterWithLinkedIn).findByLinkedIn(
            profiles[0].linkedin_url,
            token,
            profiles[0].title,
          )

          if (contact) {
            results.push(contact)
            verifiedDomain = contact.email.split('@')[1] || null
            console.log('[BatchLookup] Verified domain discovered:', verifiedDomain)
          }
        }
      } catch (err) {
        console.error('[BatchLookup] Domain discovery failed:', err)
      }
    }

    const domainToUse = verifiedDomain || fallbackDomain
    console.log('[BatchLookup] Using domain for remaining profiles:', domainToUse)

    // STEP 2: Remaining profiles via fast findByName with the verified domain
    const remainingProfiles = results.length > 0 ? profiles.slice(1) : profiles

    for (const profile of remainingProfiles) {
      const nameParts = profile.name.trim().split(/\s+/)
      if (nameParts.length < 2) continue

      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')

      for (const { provider } of providers) {
        try {
          const adapter = getAdapter(provider)
          if (typeof (adapter as unknown as AdapterWithName).findByName !== 'function') continue

          const token = await EmailFinderRepository.getValidToken(userId, provider)
          if (!token) continue

          console.log(`[BatchLookup] findByName: ${profile.name} @ ${domainToUse} via ${provider}`)
          const contact = await (adapter as unknown as AdapterWithName).findByName(
            firstName,
            lastName,
            domainToUse,
            token,
            profile.title,
            profile.linkedin_url,
          )

          if (contact) {
            results.push(contact)
            break
          }
        } catch (err) {
          console.error(`[BatchLookup] findByName error for ${provider}:`, err)
        }
      }
    }

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
