import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ManualEmailSchema = z.object({
  job_id: z.string().uuid(),
  hr_email: z.string().email(),
  hr_name: z.string().optional(),
  contribute: z.boolean().default(true),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { job_id, hr_email, hr_name, contribute } = ManualEmailSchema.parse(body)

    const supabase = await createClient()

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        hr_email,
        hr_name: hr_name || null,
        email_source: 'manual',
        status: 'email_found',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    if (contribute && job.company_domain) {
      const { error: communityError } = await supabase
        .from('community_emails')
        .insert({
          company_domain: job.company_domain,
          company_name: job.company_name,
          email: hr_email,
          email_type:
            !hr_email.startsWith('hr@') && !hr_email.startsWith('recruiting@')
              ? 'personal'
              : 'generic',
          verified_count: 0,
          failed_count: 0,
        })

      if (communityError) {
        console.error('Error contributing to community:', communityError)
      }
    }

    return NextResponse.json({
      success: true,
      message: contribute
        ? 'Email saved and contributed to community! Thank you!'
        : 'Email saved successfully!',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Manual email error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
