import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { emailAccountRepository } from '@/lib/repositories'

export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()

    const accounts = await emailAccountRepository.findAll(auth.userId)

    // Remove sensitive data
    const sanitized = accounts.map(({ smtp_password_encrypted: _, ...account }) => account)

    return ApiResponseBuilder.success(sanitized, 'Email accounts retrieved', {
      total: sanitized.length,
    })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
