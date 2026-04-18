import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { EncryptionService } from '@/lib/security/encryption-service'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const apiKeySchema = z.object({
  apollo_api_key: z.string().min(1).optional(),
  hunter_api_key: z.string().min(1).optional(),
})

export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('user_api_keys')
      .select('apollo_api_key, hunter_api_key, apollo_credits_remaining, hunter_credits_remaining, last_checked_at')
      .eq('user_id', auth.userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return ApiResponseBuilder.success({
      has_apollo_key: !!(data?.apollo_api_key),
      has_hunter_key: !!(data?.hunter_api_key),
      apollo_credits: data?.apollo_credits_remaining || 0,
      hunter_credits: data?.hunter_credits_remaining || 0,
      last_checked_at: data?.last_checked_at || null,
    })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()
    const validated = apiKeySchema.parse(body)

    if (!validated.apollo_api_key && !validated.hunter_api_key) {
      return ApiResponseBuilder.badRequest('At least one API key is required')
    }

    const supabase = createServiceClient()

    const encryptedData: Record<string, string> = {}
    if (validated.apollo_api_key) {
      encryptedData.apollo_api_key = EncryptionService.encrypt(validated.apollo_api_key)
    }
    if (validated.hunter_api_key) {
      encryptedData.hunter_api_key = EncryptionService.encrypt(validated.hunter_api_key)
    }

    const { error } = await supabase
      .from('user_api_keys')
      .upsert({
        user_id: auth.userId,
        ...encryptedData,
        updated_at: new Date().toISOString(),
      })

    if (error) throw error

    return ApiResponseBuilder.success({ saved: true }, 'API keys saved successfully')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
