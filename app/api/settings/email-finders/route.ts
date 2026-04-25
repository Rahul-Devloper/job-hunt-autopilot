import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { EmailFinderRepository } from '@/lib/repositories/email-finder-repository'
import { z } from 'zod'
import type { EmailFinderStatus } from '@/types/email-finders'

const emailFinderSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('snov'),
    client_id: z.string().min(1, 'Client ID is required'),
    client_secret: z.string().min(1, 'Client Secret is required'),
  }),
  z.object({
    provider: z.literal('hunter'),
    api_key: z.string().min(1, 'API key is required'),
  }),
  z.object({
    provider: z.literal('getprospect'),
    api_key: z.string().min(1, 'API key is required'),
  }),
])

/**
 * GET — return status for all connected providers (no encrypted keys)
 */
export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()
    const providers = await EmailFinderRepository.getProviders(auth.userId)

    const status: Record<string, EmailFinderStatus> = {}

    for (const [provider, config] of Object.entries(providers)) {
      const hasCredentials =
        'api_key' in config
          ? !!(config.api_key)
          : 'client_id' in config && 'client_secret' in config
            ? !!(config.client_id) && !!(config.client_secret)
            : false

      status[provider] = {
        connected: hasCredentials,
        credits_remaining: config.credits_remaining ?? 0,
        last_checked: config.last_checked_at ?? null,
        is_active: config.is_active ?? false,
        last_error: config.last_error,
        token_expires_at: 'token_expires_at' in config ? (config.token_expires_at as string) : undefined,
      }
    }

    return ApiResponseBuilder.success(status)
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}

/**
 * POST — connect or update an email finder provider.
 * Snov.io: exchanges OAuth credentials for an access token immediately.
 * Others: stores encrypted API key.
 */
export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()
    const validated = emailFinderSchema.parse(body)

    const credentials: Record<string, string> =
      validated.provider === 'snov'
        ? { client_id: validated.client_id, client_secret: validated.client_secret }
        : { api_key: (validated as { api_key: string }).api_key }

    await EmailFinderRepository.authenticateProvider(auth.userId, validated.provider, credentials)

    return ApiResponseBuilder.success(
      { provider: validated.provider },
      `${validated.provider} connected successfully!`
    )
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
