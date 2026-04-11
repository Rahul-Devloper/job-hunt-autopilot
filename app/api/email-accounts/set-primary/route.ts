import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { emailAccountRepository } from '@/lib/repositories'
import { emailAccountSchemas } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()

    const validated = ValidationService.validate(emailAccountSchemas.setPrimary, body)

    await emailAccountRepository.setPrimary(validated.account_id, auth.userId)

    return ApiResponseBuilder.success({ primary: true }, 'Primary account updated')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
