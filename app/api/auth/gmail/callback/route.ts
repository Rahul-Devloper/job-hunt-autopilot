import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
    return new Response(closePopupScript('error=no_code'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    // Get authenticated user from session cookies
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return new Response(closePopupScript('error=not_authenticated'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received')
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          gmail_refresh_token: encrypt(tokens.refresh_token),
          gmail_access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) throw error

    return new Response(closePopupScript('gmail=connected'), {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(closePopupScript('error=auth_failed'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

// Closes the popup and sends a message to the parent window
function closePopupScript(message: string) {
  return `<!DOCTYPE html><html><body><script>
    if (window.opener) {
      window.opener.postMessage({ type: 'gmail_oauth', params: '${message}' }, '*');
      window.close();
    } else {
      window.location.href = '/settings?${message}';
    }
  </script></body></html>`
}
