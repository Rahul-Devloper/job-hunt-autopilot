import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { documentRepository } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params

    const document = await documentRepository.findById(id, auth.userId)

    if (!document) {
      return ApiResponseBuilder.notFound('Document not found')
    }

    const supabase = await createClient()

    const { data, error } = await supabase.storage
      .from('user-documents')
      .createSignedUrl(document.file_path, 3600)

    if (error) {
      console.error('Download URL error:', error)
      return ApiResponseBuilder.error('Failed to generate download URL')
    }

    return ApiResponseBuilder.success({
      url: data.signedUrl,
      fileName: document.file_name,
    })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
