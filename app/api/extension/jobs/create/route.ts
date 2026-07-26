// NOTE: Uses raw service-role Supabase client instead of the repository layer
// because this route is called by the Chrome extension (Bearer-token auth, no
// cookies). See BaseRepository's KNOWN LIMITATION comment for context.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { AuthService } from '@/lib/auth/auth-service'
import { AuthError } from '@/lib/errors/app-error'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateFromHeader(request.headers.get('Authorization'))
    const userId = auth.userId
    const expiresIn = auth.metadata?.expiresIn as number | undefined
    const expiringSoon = !!auth.metadata?.expiringSoon

    const body = await request.json()
    const {
      company_name,
      job_title,
      job_url,
      location,
      company_domain,
      company_linkedin_url,
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
        company_linkedin_url: company_linkedin_url || null,
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
      console.error('[ExtensionCreate] Job insert error:', jobError.message)
      return NextResponse.json(
        { error: 'Failed to create job', details: jobError.message },
        { status: 500 }
      )
    }

    console.log('✅ Job created via extension:', job.id, 'User:', userId)

    const response: Record<string, unknown> = { success: true, job }

    if (expiringSoon) {
      response.warning = {
        message: `Your extension token expires in ${expiresIn} day${expiresIn === 1 ? '' : 's'}. Please reconnect from /extension`,
        expiresIn,
        severity: expiresIn! <= 3 ? 'urgent' : 'info',
      }
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[ExtensionCreate] Unexpected error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
