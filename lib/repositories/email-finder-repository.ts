import { createServiceClient } from '@/lib/supabase/server'
import { EncryptionService } from '@/lib/security/encryption-service'
import type { EmailFinderProvider, EmailFinderConfig, EmailFinderKeys } from '@/types/email-finders'

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
  ): Promise<EmailFinderConfig | null> {
    const all = await this.getProviders(userId)
    return all[provider] ?? null
  }

  /**
   * Add or update a provider config. Merges with existing data.
   */
  static async setProvider(
    userId: string,
    provider: EmailFinderProvider,
    config: Partial<EmailFinderConfig>
  ): Promise<void> {
    const supabase = createServiceClient()
    const current = await this.getProviders(userId)

    const updated: EmailFinderKeys = {
      ...current,
      [provider]: {
        api_key: config.api_key ?? current[provider]?.api_key ?? '',
        credits_remaining: config.credits_remaining ?? current[provider]?.credits_remaining ?? 0,
        last_checked_at: config.last_checked_at ?? current[provider]?.last_checked_at ?? null,
        is_active: config.is_active ?? current[provider]?.is_active ?? true,
        last_error: config.last_error,
      },
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
   * Remove a provider from the JSON map.
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
   * Deduct credits from a provider after a successful search.
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
   * Record an error against a provider (for UI display).
   */
  static async setError(
    userId: string,
    provider: EmailFinderProvider,
    error: string
  ): Promise<void> {
    const config = await this.getProvider(userId, provider)
    if (!config) return

    await this.setProvider(userId, provider, {
      last_error: error,
      last_checked_at: new Date().toISOString(),
    })
  }

  /**
   * Return active providers sorted by priority:
   * Snov (50 free) → GetProspect (50 free) → Hunter (25 free)
   */
  static async getActiveProviders(
    userId: string
  ): Promise<Array<{ provider: EmailFinderProvider; config: EmailFinderConfig }>> {
    const all = await this.getProviders(userId)

    const priority: EmailFinderProvider[] = ['snov', 'getprospect', 'hunter']

    return (
      Object.entries(all)
        .filter(([, config]) => config.is_active && config.api_key)
        .map(([provider, config]) => ({
          provider: provider as EmailFinderProvider,
          config: config as EmailFinderConfig,
        }))
        .sort((a, b) => {
          const ai = priority.indexOf(a.provider)
          const bi = priority.indexOf(b.provider)
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
        })
    )
  }

  /**
   * Decrypt and return an API key for a provider.
   */
  static async getDecryptedKey(
    userId: string,
    provider: EmailFinderProvider
  ): Promise<string | null> {
    const config = await this.getProvider(userId, provider)
    if (!config?.api_key) return null

    try {
      return EncryptionService.decrypt(config.api_key)
    } catch {
      console.error(`Failed to decrypt ${provider} key`)
      return null
    }
  }
}
