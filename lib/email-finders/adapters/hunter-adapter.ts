import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'
import { json } from 'zod'

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

      interface HunterEmail {
        value?: string
        position?: string
        first_name?: string
        last_name?: string
        confidence?: number
        linkedin?: string
      }

      interface HunterResponse {
        data?: { emails?: HunterEmail[] }
        errors?: Array<{ details?: string }>
        message?: string
      }

      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=10`
      console.log('Hunter Url==>', url)

      const response = await fetch(url, {
        cache: 'no-store', // to avoid body consumption issues as next.js caches fetch responses, we disable caching for this call since it's not critical to cache and we want to ensure fresh data and avoid potential issues with reading the response body multiple times.
      })
      const data: HunterResponse = await response.json()
      // I need to see stringified version of the response to debug issues with body consumption
      const jsonData = json.stringify(data)
      console.log('[Hunter] API response received==>', jsonData) // Log the entire response for debugging

      console.log('[Hunter] Status:', response.status)
      console.log('[Hunter] Data:', {
        hasData: !!data,
        hasEmails: !!data?.data?.emails,
        emailCount: data?.data?.emails?.length,
      })

      if (!response.ok) {
        const errorMsg =
          data.errors?.[0]?.details || data.message || 'Unknown error'
        throw new Error(`Hunter.io API error: ${response.status} - ${errorMsg}`)
      }

      if (data.errors) {
        throw new Error(`Hunter.io error: ${JSON.stringify(data.errors)}`)
      }

      const emails: HunterEmail[] = data.data?.emails || []
      console.log('[Hunter] Processing', emails.length, 'emails')

      const contacts = emails
        .filter((e) => !!e.value && this.isRelevantRole(e.position || ''))
        .map((e) => ({
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

      console.log('[Hunter] Filtered to', contacts?.length, 'relevant contacts')
      return contacts
    } catch (error) {
      console.error('[Hunter] searchByDomain error:', error)
      throw error
    }
  }

  async findByName(
    firstName: string,
    lastName: string,
    domain: string,
    apiKey: string,
    posterTitle?: string | null,
    posterLinkedIn?: string | null,
  ): Promise<Contact | null> {
    try {
      const url = `https://api.hunter.io/v2/email-finder?first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&domain=${encodeURIComponent(domain)}&api_key=${apiKey}`
      console.log('[Hunter] findByName:', firstName, lastName, '@', domain)

      interface HunterFinderResponse {
        data?: {
          email?: string
          score?: number
          position?: string
          linkedin_url?: string
        }
        errors?: Array<{ details?: string }>
        message?: string
      }

      const response = await fetch(url)
      const data: HunterFinderResponse = await response.json()

      if (!response.ok || !data.data?.email) {
        console.log('[Hunter] findByName: no email found', data.errors || data.message)
        return null
      }

      const score = data.data.score || 0
      return {
        name: `${firstName} ${lastName}`.trim(),
        email: data.data.email,
        title: posterTitle || data.data.position || 'Job Poster',
        source: 'hunter' as const,
        confidence: score > 90 ? 'high' : score > 70 ? 'medium' : ('low' as const),
        linkedin_url: posterLinkedIn || data.data.linkedin_url || undefined,
      }
    } catch (error) {
      console.error('[Hunter] findByName error:', error)
      return null
    }
  }

  getCreditsUsed(): number {
    return 1
  }
}