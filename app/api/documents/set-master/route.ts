import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { documentRepository } from '@/lib/repositories'
import { documentSchemas } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()

    const validated = ValidationService.validate(documentSchemas.setMaster, body)

    await documentRepository.setMaster(
      validated.document_id,
      auth.userId,
      validated.document_type
    )

    return ApiResponseBuilder.success(
      { master: true },
      'Master document updated'
    )
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
