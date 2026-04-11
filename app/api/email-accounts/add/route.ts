import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { EncryptionService } from '@/lib/security/encryption-service'
import { emailAccountRepository } from '@/lib/repositories'
import { emailAccountSchemas } from '@/lib/validation/schemas'
import { detectProvider } from '@/lib/smtp-providers'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()

    const validated = ValidationService.validate(emailAccountSchemas.create, body)

    // Check if email already exists for this user
    const existing = await emailAccountRepository.findByEmail(
      auth.userId,
      validated.email_address
    )

    if (existing) {
      return ApiResponseBuilder.badRequest('This email account is already connected')
    }

    // Detect provider or use custom settings
    const provider = detectProvider(validated.email_address)

    const finalHost = validated.smtp_host || provider?.host
    const finalPort = validated.smtp_port || provider?.port || 587
    const finalSecure = validated.smtp_secure ?? provider?.secure ?? false

    if (!finalHost) {
      return ApiResponseBuilder.badRequest(
        'SMTP host is required for unknown providers'
      )
    }

    // Encrypt password
    const encryptedPassword = EncryptionService.encrypt(validated.password)

    // First account becomes primary automatically
    const existingAccounts = await emailAccountRepository.findAll(auth.userId)
    const isPrimary = existingAccounts.length === 0

    // Create account
    const account = await emailAccountRepository.create({
      user_id: auth.userId,
      email_address: validated.email_address,
      provider_name: provider?.name || 'Custom',
      smtp_host: finalHost,
      smtp_port: finalPort,
      smtp_secure: finalSecure,
      smtp_user: validated.email_address,
      smtp_password_encrypted: encryptedPassword,
      is_primary: isPrimary,
      is_verified: false,
    })

    const { smtp_password_encrypted: _, ...sanitizedAccount } = account

    return ApiResponseBuilder.created(sanitizedAccount, 'Email account added successfully')
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
