import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { generateExtensionToken } from '@/lib/extension-auth'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { device_name } = body

    const supabase = await createClient()

    const token = generateExtensionToken(user.id)

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 3) // TODO: change back to 90 days for production

    const { data: tokenData, error: tokenError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: user.id,
        token,
        device_name: device_name || 'Chrome Extension',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (tokenError) {
      console.error('Error creating token:', tokenError)
      return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })
    }

    console.log('✅ Extension token created for user:', user.id)

    return NextResponse.json({
      success: true,
      token,
      expires_at: tokenData.expires_at,
    })
  } catch (error: unknown) {
    console.error('Token generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
