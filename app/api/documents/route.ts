import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { documentRepository } from '@/lib/repositories'

export async function GET(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'cv' | 'cover_letter' | null

    let documents

    if (type) {
      documents = await documentRepository.findByType(auth.userId, type)
    } else {
      documents = await documentRepository.findAll(auth.userId)
    }

    return ApiResponseBuilder.success(documents, 'Documents retrieved', {
      total: documents.length,
    })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
