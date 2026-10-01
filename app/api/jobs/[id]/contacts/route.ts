import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { jobContactRepository } from '@/lib/repositories'
import { jobContactSchemas } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase/server'
import { syncJobStatusWithContacts } from '@/lib/utils/update-job-status'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params

    const contacts = await jobContactRepository.findByJob(id, auth.userId)

    return ApiResponseBuilder.success(contacts, 'Contacts retrieved', {
      total: contacts.length,
      primary: contacts.find((c) => c.is_primary)?.id ?? null,
    })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { id } = await params
    const body = await request.json()

    const validated = ValidationService.validate(jobContactSchemas.create, {
      ...body,
      job_id: id,
    })

    // First contact for this job becomes primary automatically
    const existing = await jobContactRepository.findByJob(id, auth.userId)
    const isPrimary = validated.is_primary ?? existing.length === 0

    const contact = await jobContactRepository.create({
      ...validated,
      user_id: auth.userId,
      is_primary: isPrimary,
    })

    await syncJobStatusWithContacts(await createClient(), id, auth.userId)

    return ApiResponseBuilder.created(contact, 'Contact added')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
