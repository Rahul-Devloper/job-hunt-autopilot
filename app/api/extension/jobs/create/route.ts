import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateExtensionToken } from '@/lib/extension-auth'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    console.log('auth header==> ', authHeader)

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const validation = await validateExtensionToken(token)

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid token' },
        { status: 401 }
      )
    }

    const userId = validation.userId!

    const body = await request.json()
    const {
      company_name,
      job_title,
      job_url,
      location,
      company_domain,
      salary,
      job_description,
      poster_name,
      poster_title,
      poster_linkedin_url,
    } = body

    if (!company_name || !job_title || !job_url) {
      return NextResponse.json(
        { error: 'Missing required fields: company_name, job_title, job_url' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: userId,
        company_name,
        job_title,
        job_url,
        location: location || null,
        company_domain: company_domain || null,
        salary: salary || null,
        job_description: job_description || null,
        status: 'captured',
        poster_name: poster_name || null,
        poster_title: poster_title || null,
        poster_linkedin_url: poster_linkedin_url || null,
      })
      .select()
      .single()

    if (jobError) {
      console.error('Error creating job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create job', details: jobError.message },
        { status: 500 }
      )
    }

    console.log('✅ Job created via extension:', job.id, 'User:', userId)

    const response: Record<string, unknown> = { success: true, job }

    if (validation.expiringSoon) {
      response.warning = {
        message: `Your extension token expires in ${validation.expiresIn} day${validation.expiresIn === 1 ? '' : 's'}. Please reconnect from /extension`,
        expiresIn: validation.expiresIn,
        severity: validation.expiresIn! <= 3 ? 'urgent' : 'info',
      }
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('Extension job create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
