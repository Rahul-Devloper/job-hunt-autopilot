import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/auth-service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const auth = await AuthService.authenticateCookie()
    const supabase = await createClient()

    const { data } = await supabase
      .from('user_settings')
      .select('professional_summary, full_name, contact_line')
      .eq('user_id', auth.userId)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        professional_summary: data?.professional_summary ?? '',
        full_name: data?.full_name ?? '',
        contact_line: data?.contact_line ?? '',
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { professional_summary, full_name, contact_line } = await request.json()
    const supabase = await createClient()

    const update: {
      user_id: string
      professional_summary?: string
      full_name?: string
      contact_line?: string
    } = { user_id: auth.userId }
    if (professional_summary !== undefined) update.professional_summary = professional_summary
    if (full_name !== undefined) update.full_name = full_name
    if (contact_line !== undefined) update.contact_line = contact_line

    await supabase
      .from('user_settings')
      .upsert(update, { onConflict: 'user_id' })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save profile' }, { status: 500 })
  }
}
