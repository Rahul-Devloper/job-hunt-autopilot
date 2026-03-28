import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import crypto from 'crypto'

const SendEmailSchema = z.object({
  job_id: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
})

function decrypt(encrypted: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0))
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8')
}

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

  const { error } = await supabase.from('link_clicks').insert({
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
    const body = await request.json()
    const { job_id, to, subject, body: emailBody } = SendEmailSchema.parse(body)

    const supabase = createServiceClient()
    const userId = process.env.DEMO_USER_ID!

    // Get Gmail tokens and LinkedIn URL
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('gmail_refresh_token, gmail_access_token, linkedin_url')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings?.gmail_refresh_token) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect Gmail in Settings.' },
        { status: 400 }
      )
    }

    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    )

    oauth2Client.setCredentials({
      refresh_token: decrypt(settings.gmail_refresh_token),
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Save email record FIRST to get the ID for link tracking
    const trackingId = generateTrackingId()
    const { data: emailRecord, error: emailError } = await supabase
      .from('emails_sent')
      .insert({
        job_id,
        user_id: userId,
        to_email: to,
        subject,
        body: emailBody,
        tracking_id: trackingId,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (emailError || !emailRecord) {
      console.error('Error saving email record:', emailError)
      throw new Error('Failed to save email record')
    }

    // Build email body with LinkedIn signature if available
    let fullEmailBody = emailBody

    if (settings.linkedin_url) {
      const trackedLinkedIn = await createTrackedLinkedIn(
        supabase,
        userId,
        job_id,
        emailRecord.id,
        settings.linkedin_url
      )
      fullEmailBody += `\n\n---\nLet's connect on LinkedIn: <a href="${trackedLinkedIn}">${settings.linkedin_url}</a>`
    }

    // Add tracking pixel
    const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/track/${trackingId}`
    const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />`
    const htmlBody = fullEmailBody.replace(/\n/g, '<br>') + trackingPixel

    // Build raw email
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody,
    ].join('\n')

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send via Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    })

    // Update job status
    await supabase
      .from('jobs')
      .update({ status: 'email_sent', updated_at: new Date().toISOString() })
      .eq('id', job_id)

    // Schedule follow-up reminder in 2 days
    const followUpDate = new Date()
    followUpDate.setDate(followUpDate.getDate() + 2)

    await supabase.from('followup_reminders').insert({
      job_id,
      user_id: userId,
      email_sent_id: emailRecord.id,
      followup_number: 1,
      scheduled_for: followUpDate.toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully!',
      tracking_id: trackingId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Send email error:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: (error as Error).message },
      { status: 500 }
    )
  }
}
