import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { jobContactRepository } from '@/lib/repositories'
import { jobContactSchemas } from '@/lib/validation/schemas'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params
    const body = await request.json()

    const validated = ValidationService.validate(jobContactSchemas.setPrimary, {
      ...body,
      job_id: id,
    })

    await jobContactRepository.setPrimary(
      validated.contact_id,
      validated.job_id,
      auth.userId
    )

    return ApiResponseBuilder.success({ primary: true }, 'Primary contact updated')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
