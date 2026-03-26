import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(
  request: Request,
  { params }: { params: { trackingId: string } }
) {
  const { trackingId } = params

  try {
    const supabase = createServiceClient()

    // Mark opened only once
    await supabase
      .from('emails_sent')
      .update({ opened_at: new Date().toISOString() })
      .eq('tracking_id', trackingId)
      .is('opened_at', null)
  } catch (error) {
    console.error('Tracking pixel error:', error)
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
