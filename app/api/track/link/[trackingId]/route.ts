import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { trackingId: string } }
) {
  const { trackingId } = params

  try {
    const supabase = createServiceClient()

    const { data: link, error } = await supabase
      .from('link_clicks')
      .select('*')
      .eq('tracking_id', trackingId)
      .single()

    if (error || !link) {
      return NextResponse.redirect('https://linkedin.com')
    }

    await supabase
      .from('link_clicks')
      .update({
        clicked_at: link.clicked_at || new Date().toISOString(),
        click_count: (link.click_count || 0) + 1,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      })
      .eq('tracking_id', trackingId)

    // Update emails_sent.clicked_at on first click only
    if (link.email_sent_id && !link.clicked_at) {
      await supabase
        .from('emails_sent')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', link.email_sent_id)
        .is('clicked_at', null)
    }

    return NextResponse.redirect(link.original_url)
  } catch {
    return NextResponse.redirect('https://linkedin.com')
  }
}
