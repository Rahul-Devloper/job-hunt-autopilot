import nodemailer from 'nodemailer'
import { EncryptionService } from '@/lib/security/encryption-service'
import { emailAccountRepository, documentRepository, type EmailAccount } from '@/lib/repositories'
import { ExternalServiceError } from '@/lib/errors/app-error'
import { createClient } from '@/lib/supabase/server'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer
  }>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  account: {
    email: string
    provider: string
  }
}

async function getMasterDocumentAttachments(
  userId: string
): Promise<Array<{ filename: string; content: Buffer }>> {
  try {
    const supabase = await createClient()
    const attachments: Array<{ filename: string; content: Buffer }> = []

    const masterCV = await documentRepository.findMaster(userId, 'cv')
    if (masterCV) {
      const { data } = await supabase.storage
        .from('user-documents')
        .download(masterCV.file_path)

      if (data) {
        const buffer = Buffer.from(await data.arrayBuffer())
        attachments.push({ filename: masterCV.file_name, content: buffer })
      }
    }

    const masterCoverLetter = await documentRepository.findMaster(userId, 'cover_letter')
    if (masterCoverLetter) {
      const { data } = await supabase.storage
        .from('user-documents')
        .download(masterCoverLetter.file_path)

      if (data) {
        const buffer = Buffer.from(await data.arrayBuffer())
        attachments.push({ filename: masterCoverLetter.file_name, content: buffer })
      }
    }

    return attachments
  } catch (error) {
    console.error('Error fetching document attachments:', error)
    return []
  }
}

/**
 * Send email using user's email account from user_email_accounts table.
 * Uses the primary account if no accountId is specified.
 */
export async function sendEmail(
  userId: string,
  options: EmailOptions,
  accountId?: string
): Promise<SendEmailResult> {
  let account: EmailAccount | null

  if (accountId) {
    account = await emailAccountRepository.findById(accountId, userId)
  } else {
    account = await emailAccountRepository.findPrimary(userId)
  }

  if (!account) {
    throw new ExternalServiceError(
      'Email Account',
      'No email account found. Please add an email account in Settings.'
    )
  }

  if (!account.is_verified) {
    throw new ExternalServiceError(
      'Email Account',
      'Email account not verified. Please test the connection in Settings.'
    )
  }

  const password = EncryptionService.decrypt(account.smtp_password_encrypted)

  const transporter = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure,
    auth: {
      user: account.smtp_user,
      pass: password,
    },
  })

  const attachments =
    options.attachments && options.attachments.length > 0
      ? options.attachments
      : await getMasterDocumentAttachments(userId)

  let result: { messageId?: string }
  try {
    result = await transporter.sendMail({
      from: account.email_address,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new ExternalServiceError('Email Sending', errorMessage)
  }

  await emailAccountRepository.updateLastUsed(account.id)

  return {
    success: true,
    messageId: result.messageId,
    account: {
      email: account.email_address,
      provider: account.provider_name || 'Custom',
    },
  }
}

/**
 * Send email with optional tracking pixel and link replacements.
 */
export async function sendTrackedEmail(
  userId: string,
  options: EmailOptions & {
    trackingPixelUrl?: string
    trackedLinks?: Record<string, string>
  },
  accountId?: string
): Promise<SendEmailResult> {
  let html = options.html

  if (options.trackedLinks) {
    for (const [original, tracked] of Object.entries(options.trackedLinks)) {
      html = html.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tracked)
    }
  }

  if (options.trackingPixelUrl) {
    html += `<img src="${options.trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`
  }

  return sendEmail(userId, { ...options, html }, accountId)
}
