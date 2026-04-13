import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { documentRepository } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'
import { documentSchemas } from '@/lib/validation/schemas'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['application/pdf']

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('document_type') as string
    const displayName = formData.get('display_name') as string | null

    if (!file) {
      return ApiResponseBuilder.badRequest('No file provided')
    }

    const validated = ValidationService.validate(documentSchemas.upload, {
      document_type: documentType,
      display_name: displayName || undefined,
    })

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return ApiResponseBuilder.badRequest(
        'Invalid file type. Only PDF files are allowed.'
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return ApiResponseBuilder.badRequest(
        'File too large. Maximum size is 5MB.'
      )
    }

    const fileExt = file.name.split('.').pop()
    const filePath = `${auth.userId}/${validated.document_type}/${Date.now()}.${fileExt}`

    const supabase = await createClient()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return ApiResponseBuilder.error(
        'Failed to upload file',
        'UPLOAD_ERROR',
        500,
        uploadError
      )
    }

    const existing = await documentRepository.findByType(
      auth.userId,
      validated.document_type
    )
    const isMaster = existing.length === 0

    const document = await documentRepository.create({
      user_id: auth.userId,
      document_type: validated.document_type,
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      is_master: isMaster,
      display_name: validated.display_name || file.name,
    })

    return ApiResponseBuilder.created(
      document,
      `${validated.document_type === 'cv' ? 'CV' : 'Cover letter'} uploaded successfully`
    )
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
