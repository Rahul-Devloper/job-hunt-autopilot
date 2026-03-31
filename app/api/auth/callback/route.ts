import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/jobs'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Create user_settings if not exists
        const { data: existingSettings } = await supabase
          .from('user_settings')
          .select('user_id')
          .eq('user_id', user.id)
          .single()

        if (!existingSettings) {
          await supabase.from('user_settings').insert({
            user_id: user.id,
            email_provider: 'gmail',
          })
        }

        // Create user_stats if not exists
        const { data: existingStats } = await supabase
          .from('user_stats')
          .select('user_id')
          .eq('user_id', user.id)
          .single()

        if (!existingStats) {
          await supabase.from('user_stats').insert({
            user_id: user.id,
            emails_contributed: 0,
            reputation_score: 0,
          })
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
