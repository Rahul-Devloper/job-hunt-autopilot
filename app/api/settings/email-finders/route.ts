import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { EmailFinderRepository } from '@/lib/repositories/email-finder-repository'
import { EncryptionService } from '@/lib/security/encryption-service'
import { z } from 'zod'
import type { EmailFinderProvider, EmailFinderStatus } from '@/types/email-finders'

const addSchema = z.object({
  provider: z.enum(['snov', 'hunter', 'getprospect']),
  api_key: z.string().min(1, 'API key is required'),
})

/**
 * GET — return status for all connected providers (no encrypted keys exposed)
 */
export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()
    const providers = await EmailFinderRepository.getProviders(auth.userId)

    const status: Record<string, EmailFinderStatus> = {}
    for (const [provider, config] of Object.entries(providers)) {
      status[provider] = {
        connected: !!(config?.api_key),
        credits_remaining: config?.credits_remaining ?? 0,
        last_checked: config?.last_checked_at ?? null,
        is_active: config?.is_active ?? false,
        last_error: config?.last_error,
      }
    }

    return ApiResponseBuilder.success(status)
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}

/**
 * POST — connect or update an email finder provider
 */
export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()
    const validated = addSchema.parse(body)

    await EmailFinderRepository.setProvider(auth.userId, validated.provider as EmailFinderProvider, {
      api_key: EncryptionService.encrypt(validated.api_key),
      is_active: true,
      credits_remaining: 0,
      last_checked_at: null,
      last_error: undefined,
    })

    return ApiResponseBuilder.success(
      { provider: validated.provider },
      `${validated.provider} connected successfully!`
    )
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
