import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { ValidationService } from '@/lib/validation/validation-service'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTrackedEmail } from '@/lib/email-sending-service'
import { sendEmailSchema } from '@/lib/validation/schemas'
import crypto from 'crypto'

function generateTrackingId(): string {
  return crypto.randomBytes(16).toString('hex')
}

async function createTrackedLinkedIn(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  jobId: string,
  emailSentId: string,
  linkedinUrl: string
): Promise<string> {
  const trackingId = generateTrackingId()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('link_clicks') as any).insert({
    user_id: userId,
    job_id: jobId,
    email_sent_id: emailSentId,
    link_type: 'linkedin',
    original_url: linkedinUrl,
    tracking_id: trackingId,
  })

  if (error) {
    console.error('Error creating tracked link:', error)
    return linkedinUrl
  }

  return `${process.env.NEXT_PUBLIC_APP_URL}/api/track/link/${trackingId}`
}

export async function POST(request: Request) {
  try {
    // 1. Auth
    const auth = await AuthService.authenticateCookie()

    // 2. Validate — validated.to is string[] after the schema transform
    const body = await request.json()
    const validated = ValidationService.validate(sendEmailSchema, body)

    const supabase = createServiceClient()

    // 3. Get user settings (for LinkedIn URL)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('linkedin_url')
      .eq('user_id', auth.userId)
      .single()

    // 4. Create email record (for tracking)
    // Store multiple recipients as comma-joined string in the TEXT column
    const trackingId = generateTrackingId()
    const { data: emailRecord, error: emailError } = await supabase
      .from('emails_sent')
      .insert({
        job_id: validated.job_id,
        user_id: auth.userId,
        to_email: validated.to.join(', '),
        subject: validated.subject,
        body: validated.body,
        tracking_id: trackingId,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (emailError || !emailRecord) {
      console.error('Error saving email record:', emailError)
      throw new Error('Failed to save email record')
    }

    // 5. Build email HTML with tracked LinkedIn signature
    let emailHtml = validated.body.replace(/\n/g, '<br>')
    const trackedLinks: Record<string, string> = {}

    if (settings?.linkedin_url) {
      const trackedLinkedIn = await createTrackedLinkedIn(
        supabase,
        auth.userId,
        validated.job_id,
        emailRecord.id,
        settings.linkedin_url
      )

      emailHtml += `\n\n<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />`
      emailHtml += `<p style="margin: 0;">LinkedIn: <a href="${trackedLinkedIn}">${settings.linkedin_url}</a></p>`
    }

    // 6. Send email — nodemailer accepts string[] natively
    const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/track/${trackingId}`

    const result = await sendTrackedEmail(
      auth.userId,
      {
        to: validated.to,
        subject: validated.subject,
        html: emailHtml,
        trackingPixelUrl,
        trackedLinks,
      },
      validated.account_id
    )

    const recipientCount = validated.to.length
    console.log(`✅ Email sent via ${result.account.provider} to ${recipientCount} recipient(s): ${validated.to.join(', ')}`)

    // 7. Update job status
    await supabase
      .from('jobs')
      .update({ status: 'email_sent', updated_at: new Date().toISOString() })
      .eq('id', validated.job_id)

    // 8. Schedule follow-up reminder in 2 days
    const followUpDate = new Date()
    followUpDate.setDate(followUpDate.getDate() + 2)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('followup_reminders') as any).insert({
      job_id: validated.job_id,
      user_id: auth.userId,
      email_sent_id: emailRecord.id,
      followup_number: 1,
      scheduled_for: followUpDate.toISOString(),
    })

    // 9. Return success
    return ApiResponseBuilder.success(
      {
        tracking_id: trackingId,
        sent_from: result.account.email,
        provider: result.account.provider,
        recipient_count: recipientCount,
        recipients: validated.to,
      },
      `Email sent to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''}!`
    )
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
