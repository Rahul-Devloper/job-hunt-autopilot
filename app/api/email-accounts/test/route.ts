import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { EncryptionService } from '@/lib/security/encryption-service'
import { emailAccountRepository } from '@/lib/repositories'
import { emailAccountSchemas } from '@/lib/validation/schemas'
import nodemailer from 'nodemailer'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const body = await request.json()

    const validated = ValidationService.validate(emailAccountSchemas.test, body)

    const account = await emailAccountRepository.findById(
      validated.account_id,
      auth.userId
    )

    if (!account) {
      return ApiResponseBuilder.notFound('Email account not found')
    }

    // Decrypt password
    const password = EncryptionService.decrypt(account.smtp_password_encrypted)

    // Create transporter and verify connection
    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure,
      auth: {
        user: account.smtp_user,
        pass: password,
      },
    })

    await transporter.verify()

    // Mark account as verified
    await emailAccountRepository.update(
      validated.account_id,
      { is_verified: true },
      auth.userId
    )

    return ApiResponseBuilder.success({ verified: true }, 'Connection successful!')
  } catch (error) {
    console.error('SMTP test error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('Invalid login') || errorMessage.includes('authentication')) {
      return ApiResponseBuilder.badRequest(
        'Invalid email or password. Please check your credentials.'
      )
    }

    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      return ApiResponseBuilder.badRequest(
        'Could not connect to email server. Please check SMTP settings.'
      )
    }

    return ApiResponseBuilder.badRequest(`Connection failed: ${errorMessage}`)
  }
}
