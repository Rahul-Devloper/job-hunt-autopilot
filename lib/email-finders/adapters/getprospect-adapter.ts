import axios from 'axios'
import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

export class GetProspectAdapter extends BaseEmailFinderAdapter {
  readonly id = 'getprospect'
  readonly name = 'GetProspect'

  async authenticate(credentials: { api_key: string }): Promise<AuthResult> {
    return { token: credentials.api_key, expires_at: null }
  }

  /**
   * GetProspect does NOT support domain-only search.
   * Returns empty array — domain search is handled by Hunter only.
   */
  async searchByDomain(_domain: string, _apiKey: string): Promise<Contact[]> {
    console.log('[GetProspect] Domain-only search not supported — skipping')
    return []
  }

  /**
   * Find a specific person's email by full name + domain.
   * Endpoint: GET /v2/email-finder
   */
  async findByName(
    firstName: string,
    lastName: string,
    domain: string,
    apiKey: string,
    posterTitle?: string | null,
    posterLinkedIn?: string | null,
  ): Promise<Contact | null> {
    try {
      const fullName = `${firstName} ${lastName}`.trim()
      console.log('[GetProspect] findByName:', fullName, '@', domain)

      interface GetProspectFinderResponse {
        success?: boolean
        data?: {
          email?: string
          confidence?: number
          position?: string
          linkedin?: string
        }
        errors?: string[]
      }

      const { data } = await axios.get<GetProspectFinderResponse>(
        'https://api.getprospect.com/v2/email-finder',
        { params: { full_name: fullName, domain, api_key: apiKey } },
      )

      if (!data.success || !data.data?.email) {
        console.log('[GetProspect] findByName: no email found', data.errors)
        return null
      }

      const confidence = data.data.confidence || 0
      return {
        name: fullName,
        email: data.data.email,
        title: posterTitle || data.data.position || 'Job Poster',
        source: 'getprospect' as const,
        confidence: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low',
        linkedin_url: posterLinkedIn || data.data.linkedin || undefined,
      }
    } catch (error) {
      console.error('[GetProspect] findByName error:', error)
      return null
    }
  }

  /**
   * Find contact by LinkedIn profile URL.
   * Step 1: /public/v1/insights/contact → get verified firstName, lastName, company.domain
   * Step 2: Call findByName() with the verified domain (more accurate than our extracted domain)
   */
  async findByLinkedIn(
    linkedinUrl: string,
    apiKey: string,
    posterTitle?: string | null,
  ): Promise<Contact | null> {
    try {
      console.log('[GetProspect] findByLinkedIn:', linkedinUrl)

      interface GetProspectInsightResponse {
        firstName?: string
        lastName?: string
        company?: {
          name?: string
          domain?: string
          position?: string
        }
      }

      const { data } = await axios.get<GetProspectInsightResponse>(
        'https://api.getprospect.com/public/v1/insights/contact',
        { params: { linkedinUrl, api_key: apiKey } },
      )

      if (!data.firstName || !data.lastName || !data.company?.domain) {
        console.log('[GetProspect] findByLinkedIn: incomplete profile data')
        return null
      }

      console.log(`[GetProspect] findByLinkedIn → findByName: ${data.firstName} ${data.lastName} @ ${data.company.domain}`)

      return await this.findByName(
        data.firstName,
        data.lastName,
        data.company.domain,
        apiKey,
        posterTitle || data.company.position || null,
        linkedinUrl,
      )
    } catch (error) {
      console.error('[GetProspect] findByLinkedIn error:', error)
      return null
    }
  }

  getCreditsUsed(): number {
    return 1
  }
}
