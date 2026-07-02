import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/auth-service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()
    const supabase = await createClient()

    const { data } = await supabase
      .from('user_settings')
      .select('professional_summary')
      .eq('user_id', auth.userId)
      .single()

    return NextResponse.json({
      success: true,
      data: { professional_summary: data?.professional_summary ?? '' },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { professional_summary } = await request.json()
    const supabase = await createClient()

    await supabase
      .from('user_settings')
      .upsert(
        { user_id: auth.userId, professional_summary },
        { onConflict: 'user_id' }
      )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save profile' }, { status: 500 })
  }
}
