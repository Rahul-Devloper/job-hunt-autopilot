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
        { params: { first_name: firstName, last_name: lastName, domain, api_key: apiKey }, timeout: 5000 },
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
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        console.log(`[Hunter] findByName timeout for ${firstName} ${lastName} — skipping`)
      } else {
        console.error('[Hunter] findByName error:', error instanceof Error ? error.message : error)
      }
      return null
    }
  }
}
