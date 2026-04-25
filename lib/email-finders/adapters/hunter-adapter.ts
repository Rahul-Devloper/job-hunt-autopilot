import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

/**
 * Hunter.io adapter — simple API key, no token refresh needed.
 * Charges 1 credit per domain search (not per email found).
 */
export class HunterAdapter extends BaseEmailFinderAdapter {
  readonly id = 'hunter'
  readonly name = 'Hunter.io'

  async authenticate(credentials: { api_key: string }): Promise<AuthResult> {
    return { token: credentials.api_key, expires_at: null }
  }

  async searchByDomain(domain: string, apiKey: string): Promise<Contact[]> {
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=50&type=personal`
    )

    if (!response.ok) {
      throw new Error(`Hunter.io search failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`Hunter.io error: ${JSON.stringify(data.errors)}`)
    }

    interface HunterEmail {
      value?: string
      position?: string
      first_name?: string
      last_name?: string
      confidence?: number
      linkedin?: string
    }

    return (data.data?.emails || [])
      .filter((e: HunterEmail) => e.value && this.isRelevantRole(e.position || ''))
      .map((e: HunterEmail) => ({
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
        email: e.value as string,
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
  }

  // Hunter charges 1 credit per domain search
  getCreditsUsed(_contacts: Contact[]): number {
    return 1
  }
}
