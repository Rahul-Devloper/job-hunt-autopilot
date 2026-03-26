import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
)

function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0))
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=no_code`
    )
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received')
    }

    const supabase = createServiceClient()
    const userId = process.env.DEMO_USER_ID!

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          gmail_refresh_token: encrypt(tokens.refresh_token),
          gmail_access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) throw error

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?gmail=connected`
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=auth_failed`
    )
  }
}
