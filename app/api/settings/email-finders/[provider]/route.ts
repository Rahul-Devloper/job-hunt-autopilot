import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { EmailFinderRepository } from '@/lib/repositories/email-finder-repository'
import type { EmailFinderProvider } from '@/types/email-finders'

const VALID_PROVIDERS: EmailFinderProvider[] = ['snov', 'hunter', 'getprospect']

/**
 * DELETE — disconnect an email finder provider
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { provider: string } }
) {
  try {
    const auth = await AuthService.authenticateCookie()

    if (!VALID_PROVIDERS.includes(params.provider as EmailFinderProvider)) {
      return ApiResponseBuilder.badRequest(`Unknown provider: ${params.provider}`)
    }

    await EmailFinderRepository.removeProvider(auth.userId, params.provider as EmailFinderProvider)

    return ApiResponseBuilder.success({ deleted: true }, `${params.provider} removed successfully`)
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
