import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { emailAccountRepository } from '@/lib/repositories'

export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()

    const accounts = await emailAccountRepository.findAll(auth.userId)

    // Remove sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sanitized = accounts.map(({ smtp_password_encrypted, ...account }) => account)

    return ApiResponseBuilder.success(sanitized, 'Email accounts retrieved', {
      total: sanitized.length,
    })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
