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
   * Endpoint: GET /v2/email-finder?full_name=...&domain=...&api_key=...
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
      const url = `https://api.getprospect.com/v2/email-finder?full_name=${encodeURIComponent(fullName)}&domain=${encodeURIComponent(domain)}&api_key=${apiKey}`
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

      const response = await fetch(url, { cache: 'no-store' })
      const data: GetProspectFinderResponse = await response.json()

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
        confidence:
          confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low',
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
        contactInfo?: string
        getProspectId?: string
        company?: {
          name?: string
          domain?: string
          position?: string
        }
        linkedin?: Array<{ id?: string; type?: string }>
        geolocation?: string
      }

      const insightUrl = `https://api.getprospect.com/public/v1/insights/contact?linkedinUrl=${encodeURIComponent(linkedinUrl)}&api_key=${apiKey}`
      const insightResponse = await fetch(insightUrl, { cache: 'no-store' })
      const insightData: GetProspectInsightResponse = await insightResponse.json()

      console.log('[GetProspect] findByLinkedIn insight:', {
        firstName: insightData.firstName,
        lastName: insightData.lastName,
        domain: insightData.company?.domain,
      })

      if (!insightData.firstName || !insightData.lastName) {
        console.log('[GetProspect] findByLinkedIn: no profile data returned')
        return null
      }

      const verifiedDomain = insightData.company?.domain
      if (!verifiedDomain) {
        console.log('[GetProspect] findByLinkedIn: no domain in response')
        return null
      }

      const title = posterTitle || insightData.company?.position || 'Job Poster'

      console.log(`[GetProspect] findByLinkedIn → findByName: ${insightData.firstName} ${insightData.lastName} @ ${verifiedDomain}`)
      return await this.findByName(
        insightData.firstName,
        insightData.lastName,
        verifiedDomain,
        apiKey,
        title,
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
