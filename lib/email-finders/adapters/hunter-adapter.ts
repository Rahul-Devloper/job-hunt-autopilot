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
    try {
      console.log('[Hunter] Starting search for:', domain)

      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=50`

      // const url = `https://api.hunter.io/v2/domain-search?limit=10&domain=atos.com&api_key=44a9e4af7e81daeb13423a2d827a48997c193c35`

      const response = await fetch(url)
      console.log('Hunter Url==>', url)

      // ✅ CRITICAL: Check bodyUsed before reading
      if (response.bodyUsed) {
        console.error('[Hunter] Body already used before json() call!')
        throw new Error('Response body already consumed')
      }

      // ✅ Read the response once
      let data: any
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('[Hunter] Failed to parse JSON:', parseError)
        throw new Error(`Failed to parse Hunter.io response: ${parseError}`)
      }

      console.log('[Hunter] Response parsed successfully')
      console.log('[Hunter] Status:', response.status)
      console.log('[Hunter] Data:', {
        hasData: !!data,
        hasEmails: !!data?.data?.emails,
        emailCount: data?.data?.emails?.length,
      })

      // ✅ Check for errors AFTER parsing
      if (!response.ok) {
        const errorMsg =
          data.errors?.[0]?.details || data.message || 'Unknown error'
        console.error('[Hunter] API error:', errorMsg)
        throw new Error(`Hunter.io API error: ${response.status} - ${errorMsg}`)
      }

      if (data.errors) {
        console.error('[Hunter] Data contains errors:', data.errors)
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

      const emails = data.data?.emails || []
      console.log('[Hunter] Processing', emails.length, 'emails')

      const contacts = emails
        .filter((e: HunterEmail) => {
          const hasEmail = !!e.value
          const isRelevant = this.isRelevantRole(e.position || '')
          return hasEmail && isRelevant
        })
        .map((e: HunterEmail) => ({
          name:
            `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
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

      console.log('[Hunter] Filtered to', contacts.length, 'relevant contacts')
      return contacts
    } catch (error) {
      console.error('[Hunter] searchByDomain error:', error)
      // Re-throw to let service handle it
      throw error
    }
  }

  getCreditsUsed(_contacts: Contact[]): number {
    return 1
  }
}