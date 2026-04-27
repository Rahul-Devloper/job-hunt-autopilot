import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { jobRepository } from '@/lib/repositories'
import { z } from 'zod'

const createJobSchema = z.object({
  company_name: z.string().min(1),
  job_title: z.string().min(1),
  job_url: z.string().url(),
  location: z.string().optional(),
})

/**
 * Reference POST route demonstrating the standard patterns for this app:
 * AuthService → ValidationService → Repository → ApiResponseBuilder
 */
export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()
    const validated = ValidationService.validate(createJobSchema, body)

    const job = await jobRepository.create({
      user_id: auth.userId,
      ...validated,
      status: 'captured',
    })

    return ApiResponseBuilder.created(job, 'Job created successfully')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}

export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()
    const jobs = await jobRepository.findAll(auth.userId)

    return ApiResponseBuilder.success(jobs, 'Jobs retrieved successfully', {
      total: jobs.length,
    })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
