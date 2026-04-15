import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { jobContactRepository } from '@/lib/repositories'
import { jobContactSchemas } from '@/lib/validation/schemas'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { contactId } = await params
    const body = await request.json()

    const validated = ValidationService.validate(jobContactSchemas.update, body)

    const contact = await jobContactRepository.update(contactId, validated, auth.userId)

    if (!contact) {
      return ApiResponseBuilder.notFound('Contact not found')
    }

    return ApiResponseBuilder.success(contact, 'Contact updated')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { contactId } = await params

    await jobContactRepository.delete(contactId, auth.userId)

    return ApiResponseBuilder.success({ deleted: true }, 'Contact deleted')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
