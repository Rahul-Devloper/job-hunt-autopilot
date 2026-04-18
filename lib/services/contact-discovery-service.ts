import { EmailFinderRepository } from '@/lib/repositories/email-finder-repository'
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
   * Smart multi-provider contact discovery with automatic fallback.
   * Tries providers in priority order (Snov → GetProspect → Hunter) until we have 4 contacts.
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
          const apiKey = await EmailFinderRepository.getDecryptedKey(userId, provider)
          if (!apiKey) continue

          let result: ContactDiscoveryResult

          switch (provider) {
            case 'snov':
              result = await this.searchSnov(domain, apiKey)
              break
            case 'getprospect':
              result = await this.searchGetProspect(domain, apiKey)
              break
            case 'hunter':
              result = await this.searchHunter(domain, apiKey)
              break
            default:
              continue
          }

          if (result.success && result.contacts.length > 0) {
            const existingEmails = new Set(allContacts.map((c) => c.email.toLowerCase()))
            const newContacts = result.contacts.filter(
              (c) => !existingEmails.has(c.email.toLowerCase())
            )
            allContacts.push(...newContacts)
            totalCredits += result.creditsUsed
            providersUsed.push(provider)

            await EmailFinderRepository.updateCredits(userId, provider, result.creditsUsed)
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
        .map((contact) => ({
          ...contact,
          _score: this.scoreContact(contact.title, jobTitle),
        }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 4)
        .map(({ _score: _, ...contact }) => contact as Contact)

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

  // ─── Snov.io ──────────────────────────────────────────────────────────────

  private static async searchSnov(
    domain: string,
    apiKey: string
  ): Promise<ContactDiscoveryResult> {
    try {
      const response = await fetch('https://api.snov.io/v1/get-emails-from-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ domain, type: 'all', limit: 20 }),
      })

      if (!response.ok) throw new Error(`Snov.io API error: ${await response.text()}`)

      const data = await response.json()

      interface SnovEmail {
        email?: string
        type?: string
        status?: string
        position?: string
        firstName?: string
        lastName?: string
        linkedin?: string
      }

      const contacts: Contact[] = (data.emails || [])
        .filter(
          (e: SnovEmail) =>
            e.email && (e.type === 'personal' || e.status === 'valid') && this.isRelevantRole(e.position || '')
        )
        .map((e: SnovEmail) => ({
          name: e.firstName && e.lastName ? `${e.firstName} ${e.lastName}` : 'Unknown',
          email: e.email as string,
          title: e.position || 'Unknown',
          source: 'snov' as const,
          confidence: e.status === 'valid' ? ('high' as const) : ('medium' as const),
          linkedin_url: e.linkedin,
        }))

      return { contacts, method: 'snov', creditsUsed: contacts.length, success: contacts.length > 0 }
    } catch (err) {
      return {
        contacts: [],
        method: 'snov',
        creditsUsed: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  // ─── GetProspect ──────────────────────────────────────────────────────────

  private static async searchGetProspect(
    domain: string,
    apiKey: string
  ): Promise<ContactDiscoveryResult> {
    try {
      const response = await fetch(
        `https://api.getprospect.com/public/v1/domain-search?domain=${encodeURIComponent(domain)}&limit=20`,
        { headers: { 'X-Api-Key': apiKey } }
      )

      if (!response.ok) throw new Error(`GetProspect API error: ${await response.text()}`)

      const data = await response.json()

      interface GPEmail {
        email?: string
        position?: string
        first_name?: string
        last_name?: string
        confidence?: number
        linkedin_url?: string
      }

      const contacts: Contact[] = (data.emails || [])
        .filter((e: GPEmail) => e.email && this.isRelevantRole(e.position || ''))
        .map((e: GPEmail) => ({
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
          email: e.email as string,
          title: e.position || 'Unknown',
          source: 'getprospect' as const,
          confidence: (e.confidence || 0) > 80 ? ('high' as const) : ('medium' as const),
          linkedin_url: e.linkedin_url,
        }))

      return { contacts, method: 'getprospect', creditsUsed: 1, success: contacts.length > 0 }
    } catch (err) {
      return {
        contacts: [],
        method: 'getprospect',
        creditsUsed: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  // ─── Hunter.io ────────────────────────────────────────────────────────────

  private static async searchHunter(
    domain: string,
    apiKey: string
  ): Promise<ContactDiscoveryResult> {
    try {
      const response = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=20&type=personal`
      )

      if (!response.ok) throw new Error(`Hunter API error: ${await response.text()}`)

      const data = await response.json()

      interface HunterEmail {
        email?: string
        value?: string
        position?: string
        first_name?: string
        last_name?: string
        confidence?: number
        linkedin?: string
      }

      const contacts: Contact[] = (data.data?.emails || [])
        .filter((e: HunterEmail) => (e.email || e.value) && this.isRelevantRole(e.position || ''))
        .map((e: HunterEmail) => ({
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
          email: (e.value || e.email) as string,
          title: e.position || 'Unknown',
          source: 'hunter' as const,
          confidence:
            (e.confidence || 0) > 90
              ? ('high' as const)
              : (e.confidence || 0) > 70
                ? ('medium' as const)
                : ('low' as const),
          linkedin_url: e.linkedin,
        }))

      return { contacts, method: 'hunter', creditsUsed: 1, success: contacts.length > 0 }
    } catch (err) {
      return {
        contacts: [],
        method: 'hunter',
        creditsUsed: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private static isRelevantRole(title: string): boolean {
    const t = title.toLowerCase()
    return (
      t.includes('recruit') ||
      t.includes('talent') ||
      t.includes('hiring') ||
      t.includes('hr') ||
      t.includes('people') ||
      t.includes('manager') ||
      t.includes('director') ||
      t.includes('head') ||
      t.includes('vp') ||
      t.includes('chief')
    )
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
    if (t.includes('chief') || t.includes('cto') || t.includes('cmo')) score += 45

    if (j.includes('engineer') && t.includes('engineering')) score += 25
    if (j.includes('marketing') && t.includes('marketing')) score += 25
    if (j.includes('sales') && t.includes('sales')) score += 25
    if (j.includes('product') && t.includes('product')) score += 25

    return score
  }

  /**
   * Extract domain from company name or URL.
   * Falls back to guessing `companyname.com`.
   */
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
