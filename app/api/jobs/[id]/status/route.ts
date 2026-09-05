import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { jobRepository } from '@/lib/repositories'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['captured', 'email_found', 'email_sent', 'interview', 'offer', 'rejected']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params
    const body = await request.json()

    const validated = ValidationService.validate(updateStatusSchema, body)

    const job = await jobRepository.update(id, { status: validated.status }, auth.userId)

    return ApiResponseBuilder.success(job, 'Status updated successfully')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
