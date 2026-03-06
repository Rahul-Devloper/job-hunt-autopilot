import { NextResponse } from 'next/server'

export async function GET() {
  // Job list logic coming in Session 2
  return NextResponse.json({ message: 'Coming in Session 2' }, { status: 501 })
}
