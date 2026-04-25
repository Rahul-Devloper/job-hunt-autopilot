import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

/**
 * GetProspect adapter — simple API key, no token refresh needed.
 * Charges 1 credit per domain search.
 */
export class GetProspectAdapter extends BaseEmailFinderAdapter {
  readonly id = 'getprospect'
  readonly name = 'GetProspect'

  async authenticate(credentials: { api_key: string }): Promise<AuthResult> {
    return { token: credentials.api_key, expires_at: null }
  }

  async searchByDomain(domain: string, apiKey: string): Promise<Contact[]> {
    const response = await fetch(
      `https://api.getprospect.com/public/v1/domain-search?domain=${encodeURIComponent(domain)}&limit=50`,
      { headers: { 'X-Api-Key': apiKey } }
    )

    if (!response.ok) {
      throw new Error(`GetProspect search failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()

    interface GPEmail {
      email?: string
      position?: string
      first_name?: string
      last_name?: string
      confidence?: number
      linkedin_url?: string
    }

    return (data.emails || [])
      .filter((e: GPEmail) => e.email && this.isRelevantRole(e.position || ''))
      .map((e: GPEmail) => ({
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
        email: e.email as string,
        title: e.position || 'Unknown',
        source: 'getprospect' as const,
        confidence: (e.confidence || 0) > 80 ? ('high' as const) : ('medium' as const),
        linkedin_url: e.linkedin_url,
      }))
  }

  // GetProspect charges 1 credit per domain search
  getCreditsUsed(_contacts: Contact[]): number {
    return 1
  }
}
