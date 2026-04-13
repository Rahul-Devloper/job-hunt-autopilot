import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { documentRepository } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
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

    const { error: storageError } = await supabase.storage
      .from('user-documents')
      .remove([document.file_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
    }

    await documentRepository.delete(id, auth.userId)

    return ApiResponseBuilder.success(
      { deleted: true },
      'Document deleted'
    )
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
