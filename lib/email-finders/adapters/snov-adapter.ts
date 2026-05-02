import axios from 'axios'
import { BaseEmailFinderAdapter } from './base-adapter'
import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

export class SnovAdapter extends BaseEmailFinderAdapter {
  readonly id = 'snov'
  readonly name = 'Snov.io'

  requiresRefresh(): boolean {
    return true
  }

  async authenticate(credentials: {
    client_id: string
    client_secret: string
  }): Promise<AuthResult> {
    try {
      interface SnovAuthResponse {
        access_token?: string
        expires_in?: number
        error?: string
      }

      const { data } = await axios.post<SnovAuthResponse>(
        'https://api.snov.io/v1/oauth/access_token',
        {
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
          grant_type: 'client_credentials',
        },
      )

      if (!data.access_token) {
        throw new Error(data.error || 'No access token received from Snov.io')
      }

      const expiresAt = new Date(
        Date.now() + (data.expires_in ?? 0) * 1000,
      ).toISOString()

      return {
        token: data.access_token,
        expires_at: expiresAt,
      }
    } catch (error) {
      console.error('Snov.io authentication error:', error)
      throw error
    }
  }

  async refreshAuth(config: {
    client_id: string
    client_secret: string
  }): Promise<AuthResult> {
    return this.authenticate(config)
  }

  async searchByDomain(): Promise<Contact[]> {
    // Snov.io v2 API requires async polling - skip for now
    console.warn('[Snov] Domain search not implemented (requires v2 async API)')
    return []
  }

  getCreditsUsed(contacts: Contact[]): number {
    return contacts.length
  }
}
