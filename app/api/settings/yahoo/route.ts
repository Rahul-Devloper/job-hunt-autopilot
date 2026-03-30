import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/email-service'
import { z } from 'zod'

const YahooSchema = z.object({
  yahoo_email: z.string().email(),
  yahoo_password: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { yahoo_email, yahoo_password } = YahooSchema.parse(body)

    const supabase = createServiceClient()
    const userId = process.env.DEMO_USER_ID!

    const { error } = await supabase
      .from('user_settings')
      .update({
        yahoo_email,
        yahoo_password_encrypted: encrypt(yahoo_password),
        email_provider: 'yahoo',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Save Yahoo settings error:', error)
    return NextResponse.json({ error: 'Failed to save Yahoo credentials' }, { status: 500 })
  }
}
