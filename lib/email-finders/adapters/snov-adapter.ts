import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

/**
 * Snov.io adapter — OAuth 2.0 Client Credentials flow.
 * Tokens expire in 1 hour and are auto-refreshed by the repository.
 */
export class SnovAdapter extends BaseEmailFinderAdapter {
  readonly id = 'snov'
  readonly name = 'Snov.io'

  requiresRefresh(): boolean {
    return true
  }

  async authenticate(credentials: { client_id: string; client_secret: string }): Promise<AuthResult> {
    const response = await fetch('https://api.snov.io/v1/get-access-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
      }),
    })

    if (!response.ok) {
      throw new Error(`Snov.io auth failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()

    if (!data.access_token) {
      throw new Error('No access_token in Snov.io response')
    }

    return {
      token: data.access_token,
      expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    }
  }

  async refreshAuth(config: { client_id: string; client_secret: string }): Promise<AuthResult> {
    return this.authenticate(config)
  }

  async searchByDomain(domain: string, accessToken: string): Promise<Contact[]> {
    const response = await fetch('https://api.snov.io/v1/get-domain-emails-with-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ domain, type: 'personal', limit: 50, lastId: 0 }),
    })

    if (!response.ok) {
      throw new Error(`Snov.io search failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error('Snov.io returned success: false')
    }

    interface SnovEmail {
      email?: string
      valid?: string
      emailStatus?: string
      position?: string
      firstName?: string
      lastName?: string
      social?: { linkedin?: string }
    }

    return (data.emails || [])
      .filter(
        (e: SnovEmail) =>
          e.email &&
          (e.valid === 'valid' || e.emailStatus === 'verified') &&
          this.isRelevantRole(e.position || '')
      )
      .map((e: SnovEmail) => ({
        name: e.firstName && e.lastName ? `${e.firstName} ${e.lastName}` : 'Unknown',
        email: e.email as string,
        title: e.position || 'Unknown',
        source: 'snov' as const,
        confidence:
          e.emailStatus === 'verified' || e.valid === 'valid'
            ? ('high' as const)
            : ('medium' as const),
        linkedin_url: e.social?.linkedin,
      }))
  }

  // Snov charges 1 credit per email returned
  getCreditsUsed(contacts: Contact[]): number {
    return contacts.length
  }
}
