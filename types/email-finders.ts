/**
 * Supported email finder providers.
 * Add new providers here without database changes.
 */
export type EmailFinderProvider = 'snov' | 'hunter' | 'getprospect'

/**
 * Configuration for each email finder provider (stored encrypted in JSONB)
 */
export interface EmailFinderConfig {
  api_key: string
  credits_remaining: number
  last_checked_at: string | null
  is_active: boolean
  last_error?: string
}

/**
 * Map of all email finder keys stored in JSONB column
 */
export type EmailFinderKeys = {
  [K in EmailFinderProvider]?: EmailFinderConfig
}

/**
 * Provider metadata used in the UI
 */
export interface EmailFinderProviderInfo {
  id: EmailFinderProvider
  name: string
  freeCredits: number
  signupUrl: string
  docsUrl: string
  description: string
  apiKeyLabel: string
}

/**
 * Per-provider status returned to the UI (no encrypted key exposed)
 */
export interface EmailFinderStatus {
  connected: boolean
  credits_remaining: number
  last_checked: string | null
  is_active: boolean
  last_error?: string
}
