import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
  poster_name: z.string().nullable().optional(),
  poster_title: z.string().nullable().optional(),
  poster_linkedin_url: z.string().nullable().optional(),
  // Optional: extension sends this after user logs in via web
  user_id: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = JobSchema.parse(body)

    // Try session-based auth first (web app)
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    let userId: string
    let supabase: ReturnType<typeof createServiceClient>
    console.log('user==> ', user)

    if (user) {
      // Authenticated via session (web app)
      userId = user.id
      supabase = createServiceClient()
    } else if (validatedData.user_id) {
      // Extension sends user_id after login
      userId = validatedData.user_id
      supabase = createServiceClient()
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id: _uid, ...jobData } = validatedData

    const { data, error } = await supabase
      .from('jobs')
      .insert({ ...jobData, user_id: userId })
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
