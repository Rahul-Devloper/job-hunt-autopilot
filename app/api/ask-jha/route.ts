import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { askJHA } from '@/lib/ask-jha'
import { z } from 'zod'

const askJHASchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(500, 'Question is too long'),
})

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()
    const { question } = ValidationService.validate(askJHASchema, body)

    const result = await askJHA(question, auth.userId)

    return ApiResponseBuilder.success(result)
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
