import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { jobRepository } from '@/lib/repositories'
import { z } from 'zod'

const updateEmailSchema = z.object({
  hr_email: z.string().email('Invalid email format'),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params
    const body = await request.json()

    const validated = ValidationService.validate(updateEmailSchema, body)

    const job = await jobRepository.update(
      id,
      {
        hr_email: validated.hr_email,
        email_source: 'manual',
        status: 'email_found',
      },
      auth.userId
    )

    return ApiResponseBuilder.success(job, 'Email updated successfully')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params

    const job = await jobRepository.update(
      id,
      {
        hr_email: null,
        email_source: null,
        status: 'captured',
      },
      auth.userId
    )

    return ApiResponseBuilder.success(job, 'Email removed')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
