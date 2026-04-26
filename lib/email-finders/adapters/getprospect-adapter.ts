import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

export class GetProspectAdapter extends BaseEmailFinderAdapter {
  readonly id = 'getprospect'
  readonly name = 'GetProspect'

  async authenticate(credentials: { api_key: string }): Promise<AuthResult> {
    return { token: credentials.api_key, expires_at: null }
  }

  async searchByDomain(domain: string, apiKey: string): Promise<Contact[]> {
    try {
      console.log('[GetProspect] Starting search for:', domain)

      const response = await fetch(
        `https://api.getprospect.com/public/v1/domain-search?domain=${encodeURIComponent(domain)}&limit=100`,
        {
          headers: {
            'X-Api-Key': apiKey,
          },
        },
      )

      // Check if body already consumed
      if (response.bodyUsed) {
        console.error('[GetProspect] Body already used!')
        throw new Error('Response body already consumed')
      }

      interface GetProspectEmail {
        email?: string
        position?: string
        first_name?: string
        last_name?: string
        confidence?: number
        linkedin_url?: string
      }

      interface GetProspectResponse {
        emails?: GetProspectEmail[]
        message?: string
      }

      let data: GetProspectResponse
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('[GetProspect] Failed to parse JSON:', parseError)
        throw new Error(`Failed to parse GetProspect response: ${parseError}`)
      }

      console.log('[GetProspect] Response parsed successfully')

      if (!response.ok) {
        const errorMsg = data.message || 'Unknown error'
        console.error('[GetProspect] API error:', errorMsg)
        throw new Error(
          `GetProspect API error: ${response.status} - ${errorMsg}`,
        )
      }

      const emails = data.emails || []
      console.log('[GetProspect] Processing', emails.length, 'emails')

      const contacts = emails
        .filter((e: GetProspectEmail) => e.email && this.isRelevantRole(e.position || ''))
        .map((e: GetProspectEmail) => ({
          name:
            `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
          email: e.email as string,
          title: e.position || 'Unknown',
          source: 'getprospect' as const,
          confidence:
            (e.confidence || 0) > 80 ? ('high' as const) : ('medium' as const),
          linkedin_url: e.linkedin_url,
        }))

      console.log('[GetProspect] Filtered to', contacts.length, 'contacts')
      return contacts
    } catch (error) {
      console.error('[GetProspect] searchByDomain error:', error)
      throw error
    }
  }

  getCreditsUsed(): number {
    return 1
  }
}