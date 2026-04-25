/**
 * Supported email finder providers.
 * Add new providers here without database changes.
 */
export type EmailFinderProvider = 'snov' | 'hunter' | 'getprospect'

/**
 * Base configuration shared by all providers
 */
export interface BaseProviderConfig {
  is_active: boolean
  credits_remaining: number
  last_checked_at?: string | null
  last_error?: string
}

/**
 * Snov.io — OAuth 2.0 Client Credentials
 */
export interface SnovConfig extends BaseProviderConfig {
  client_id: string       // Encrypted
  client_secret: string   // Encrypted
  access_token?: string   // Encrypted, refreshed hourly
  token_expires_at?: string
}

/**
 * Simple API key providers (Hunter, GetProspect)
 */
export interface ApiKeyConfig extends BaseProviderConfig {
  api_key: string  // Encrypted
}

/**
 * All provider configs stored in the email_finder_keys JSONB column
 */
export interface EmailFinderKeys {
  snov?: SnovConfig
  hunter?: ApiKeyConfig
  getprospect?: ApiKeyConfig
}

/**
 * Auth result returned by adapters
 */
export interface AuthResult {
  token: string
  expires_at?: string | null
}

/**
 * Credentials submitted from the UI
 */
export type ProviderCredentials =
  | { provider: 'snov'; client_id: string; client_secret: string }
  | { provider: 'hunter'; api_key: string }
  | { provider: 'getprospect'; api_key: string }

/**
 * Provider metadata for UI display
 */
export interface EmailFinderProviderInfo {
  id: EmailFinderProvider
  name: string
  freeCredits: number
  signupUrl: string
  docsUrl: string
  description: string
  authType: 'oauth' | 'api_key'
  credentialLabels: Record<string, string>
}

/**
 * Per-provider status returned to the UI (no encrypted keys exposed)
 */
export interface EmailFinderStatus {
  connected: boolean
  credits_remaining: number
  last_checked: string | null
  is_active: boolean
  last_error?: string
  token_expires_at?: string
}
