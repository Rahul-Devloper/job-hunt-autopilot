import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const JobSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_domain: z.string().nullable().optional(),
  job_title: z.string().min(1, 'Job title is required'),
  job_url: z.string().url('Invalid job URL'),
  location: z.string().nullable().optional(),
  salary: z.string().nullable().optional(),
  job_description: z.string().nullable().optional(),
  status: z
    .enum(['captured', 'email_found', 'email_sent', 'interview', 'offer', 'rejected'])
    .default('captured'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = JobSchema.parse(body)

    const supabase = await createClient()

    // TODO: replace with real user from extension auth
    // Get this from: Supabase Dashboard → Authentication → Users → copy your user ID
    const demoUserId = process.env.DEMO_USER_ID || '00000000-0000-0000-0000-000000000000'

    const { data, error } = await supabase
      .from('jobs')
      .insert({ ...validatedData, user_id: demoUserId })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to save job' }, { status: 500 })
    }

    return NextResponse.json({ success: true, job: data })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// CORS preflight for extension
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
