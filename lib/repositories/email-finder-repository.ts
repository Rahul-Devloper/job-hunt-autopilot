import { createServiceClient } from '@/lib/supabase/server'
import { EncryptionService } from '@/lib/security/encryption-service'
import { getAdapter } from '@/lib/email-finders/adapters'
import type {
  EmailFinderProvider,
  EmailFinderKeys,
  BaseProviderConfig,
  SnovConfig,
  ApiKeyConfig,
  AuthResult,
} from '@/types/email-finders'

export class EmailFinderRepository {
  /**
   * Get all email finder provider configs for a user.
   */
  static async getProviders(userId: string): Promise<EmailFinderKeys> {
    try {
      const supabase = createServiceClient()

      const { data, error } = await supabase
        .from('user_api_keys')
        .select('email_finder_keys')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return (data?.email_finder_keys as EmailFinderKeys) || {}
    } catch {
      return {}
    }
  }

  /**
   * Get a single provider config.
   */
  static async getProvider(
    userId: string,
    provider: EmailFinderProvider
  ): Promise<BaseProviderConfig | null> {
    const all = await this.getProviders(userId)
    return all[provider] ?? null
  }

  /**
   * Authenticate with a provider and persist encrypted credentials.
   * Handles both OAuth (Snov) and API key (Hunter, GetProspect) flows.
   */
  static async authenticateProvider(
    userId: string,
    provider: EmailFinderProvider,
    credentials: Record<string, string>
  ): Promise<AuthResult> {
    const adapter = getAdapter(provider)
    const authResult = await adapter.authenticate(credentials)

    const config: Record<string, unknown> = {
      is_active: true,
      credits_remaining: 0,
      last_checked_at: new Date().toISOString(),
      last_error: undefined,
    }

    if (provider === 'snov') {
      config.client_id = EncryptionService.encrypt(credentials.client_id)
      config.client_secret = EncryptionService.encrypt(credentials.client_secret)
      config.access_token = EncryptionService.encrypt(authResult.token)
      config.token_expires_at = authResult.expires_at ?? null
    } else {
      config.api_key = EncryptionService.encrypt(credentials.api_key)
    }

    await this.setProvider(userId, provider, config as Partial<BaseProviderConfig>)

    return authResult
  }

  /**
   * Return a valid (decrypted) token for a provider, auto-refreshing if needed.
   */
  static async getValidToken(
    userId: string,
    provider: EmailFinderProvider
  ): Promise<string | null> {
    const adapter = getAdapter(provider)
    const config = await this.getProvider(userId, provider)
    if (!config) return null

    // OAuth providers — check expiry and refresh if needed
    if (adapter.requiresRefresh() && provider === 'snov') {
      const snov = config as SnovConfig

      if (snov.token_expires_at) {
        const expiresAt = new Date(snov.token_expires_at)
        const refreshThreshold = new Date(Date.now() + 5 * 60 * 1000)

        if (expiresAt <= refreshThreshold) {
          try {
            const clientId = EncryptionService.decrypt(snov.client_id)
            const clientSecret = EncryptionService.decrypt(snov.client_secret)
            const newAuth = await adapter.refreshAuth!({ client_id: clientId, client_secret: clientSecret })

            await this.setProvider(userId, provider, {
              access_token: EncryptionService.encrypt(newAuth.token),
              token_expires_at: newAuth.expires_at ?? null,
              last_checked_at: new Date().toISOString(),
            } as Partial<BaseProviderConfig>)

            return newAuth.token
          } catch (err) {
            console.error('Snov.io token refresh failed:', err)
            await this.setError(userId, provider, 'Token refresh failed')
            return null
          }
        }
      }

      if (snov.access_token) return EncryptionService.decrypt(snov.access_token)
      return null
    }

    // Simple API key providers
    const keyConfig = config as ApiKeyConfig
    if (keyConfig.api_key) return EncryptionService.decrypt(keyConfig.api_key)

    return null
  }

  /**
   * Set or merge provider config in the JSONB column.
   */
  static async setProvider(
    userId: string,
    provider: EmailFinderProvider,
    config: Partial<BaseProviderConfig>
  ): Promise<void> {
    const supabase = createServiceClient()
    const current = await this.getProviders(userId)

    const updated: EmailFinderKeys = {
      ...current,
      [provider]: {
        ...current[provider],
        ...config,
        is_active: config.is_active ?? current[provider]?.is_active ?? true,
        credits_remaining: config.credits_remaining ?? current[provider]?.credits_remaining ?? 0,
      } as SnovConfig | ApiKeyConfig,
    }

    const { error } = await supabase
      .from('user_api_keys')
      .upsert(
        {
          user_id: userId,
          email_finder_keys: updated as unknown as import('@/types/database').Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) throw error
  }

  /**
   * Remove a provider from the JSONB map.
   */
  static async removeProvider(userId: string, provider: EmailFinderProvider): Promise<void> {
    const supabase = createServiceClient()
    const current = await this.getProviders(userId)
    delete current[provider]

    const { error } = await supabase
      .from('user_api_keys')
      .update({
        email_finder_keys: current as unknown as import('@/types/database').Json,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) throw error
  }

  /**
   * Deduct credits after a successful search.
   */
  static async updateCredits(
    userId: string,
    provider: EmailFinderProvider,
    creditsUsed: number
  ): Promise<void> {
    const config = await this.getProvider(userId, provider)
    if (!config) return

    await this.setProvider(userId, provider, {
      credits_remaining: Math.max(0, config.credits_remaining - creditsUsed),
      last_checked_at: new Date().toISOString(),
    })
  }

  /**
   * Record an error against a provider (shown in UI).
   */
  static async setError(
    userId: string,
    provider: EmailFinderProvider,
    error: string
  ): Promise<void> {
    await this.setProvider(userId, provider, {
      last_error: error,
      last_checked_at: new Date().toISOString(),
    })
  }

  /**
   * Return active providers sorted by priority: Snov → GetProspect → Hunter
   */
  static async getActiveProviders(
    userId: string
  ): Promise<Array<{ provider: EmailFinderProvider; config: BaseProviderConfig }>> {
    const all = await this.getProviders(userId)
    const priority: EmailFinderProvider[] = ['snov', 'getprospect', 'hunter']

    return Object.entries(all)
      .filter(([, config]) => {
        if (!config?.is_active) return false
        if ('api_key' in config) return !!(config as ApiKeyConfig).api_key
        if ('client_id' in config) return !!(config as SnovConfig).client_id && !!(config as SnovConfig).client_secret
        return false
      })
      .map(([provider, config]) => ({
        provider: provider as EmailFinderProvider,
        config: config as BaseProviderConfig,
      }))
      .sort((a, b) => {
        const ai = priority.indexOf(a.provider)
        const bi = priority.indexOf(b.provider)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
  }
}
