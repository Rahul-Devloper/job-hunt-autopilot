import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { emailAccountRepository } from '@/lib/repositories'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params

    await emailAccountRepository.delete(id, auth.userId)

    return ApiResponseBuilder.success({ deleted: true }, 'Email account deleted')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
