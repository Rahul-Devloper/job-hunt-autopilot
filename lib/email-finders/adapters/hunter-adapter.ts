import axios from 'axios'
import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

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

      console.log('[Hunter] searchByDomain:', domain)

      const { data } = await axios.get<HunterResponse>(
        'https://api.hunter.io/v2/domain-search',
        { params: { domain, api_key: apiKey, limit: 10 } },
      )

      const emails: HunterEmail[] = data.data?.emails || []
      console.log('[Hunter] Processing', emails.length, 'emails')

      const contacts = emails
        .filter((e) => !!e.value && this.isRelevantRole(e.position || ''))
        .map((e) => ({
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
          email: e.value as string,
          title: e.position || 'Unknown',
          source: 'hunter' as const,
          confidence:
            (e.confidence || 0) > 90 ? ('high' as const)
            : (e.confidence || 0) > 70 ? ('medium' as const)
            : ('low' as const),
          linkedin_url: e.linkedin,
        }))

      console.log('[Hunter] Filtered to', contacts.length, 'relevant contacts')
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

      const { data } = await axios.get<HunterFinderResponse>(
        'https://api.hunter.io/v2/email-finder',
        { params: { first_name: firstName, last_name: lastName, domain, api_key: apiKey } },
      )

      if (!data.data?.email) {
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
