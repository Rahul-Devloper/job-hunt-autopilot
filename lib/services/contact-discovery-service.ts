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
