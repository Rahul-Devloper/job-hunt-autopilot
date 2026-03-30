import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendViaGmail, sendViaYahoo } from '@/lib/email-service'
import { z } from 'zod'
import crypto from 'crypto'

const SendEmailSchema = z.object({
  job_id: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
})

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

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'User settings not found' }, { status: 400 })
    }

    const provider = settings.email_provider || 'gmail'

    // Validate provider credentials before doing any work
    if (provider === 'yahoo') {
      if (!settings.yahoo_email || !settings.yahoo_password_encrypted) {
        return NextResponse.json(
          { error: 'Yahoo email not configured. Add credentials in Settings.' },
          { status: 400 }
        )
      }
    } else {
      if (!settings.gmail_refresh_token) {
        return NextResponse.json(
          { error: 'Gmail not connected. Please connect Gmail in Settings.' },
          { status: 400 }
        )
      }
    }

    // Save email record first (needed for link tracking)
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

    // Build body with tracked LinkedIn signature
    let fullEmailBody = emailBody

    if (settings.linkedin_url) {
      const trackedLinkedIn = await createTrackedLinkedIn(
        supabase,
        userId,
        job_id,
        emailRecord.id,
        settings.linkedin_url
      )
      fullEmailBody += `\n\n---\nLinkedIn: <a href="${trackedLinkedIn}">${settings.linkedin_url}</a>`
    }

    // Add tracking pixel
    const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/track/${trackingId}`
    const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />`
    const htmlBody = fullEmailBody.replace(/\n/g, '<br>') + trackingPixel

    // Send via the selected provider
    console.log(`📧 Sending via: ${provider}`)

    if (provider === 'yahoo') {
      await sendViaYahoo(settings.yahoo_email!, settings.yahoo_password_encrypted!, to, subject, htmlBody)
    } else {
      await sendViaGmail(settings.gmail_refresh_token!, to, subject, htmlBody)
    }

    console.log(`✅ Email sent via ${provider}`)

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
      message: `Email sent successfully via ${provider}!`,
      tracking_id: trackingId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }

    console.error('Send email error:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: (error as Error).message },
      { status: 500 }
    )
  }
}
