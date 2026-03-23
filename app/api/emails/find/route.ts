import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import dns from 'dns/promises'

const FindEmailSchema = z.object({
  job_id: z.string().uuid(),
  company_domain: z.string().min(1),
})

const EMAIL_PATTERNS = [
  'hr@{domain}',
  'recruiting@{domain}',
  'careers@{domain}',
  'jobs@{domain}',
  'talent@{domain}',
  'recruitment@{domain}',
  'hiring@{domain}',
  'apply@{domain}',
]

async function verifyEmailViaDNS(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1]
    const mxRecords = await dns.resolveMx(domain)
    return mxRecords.length > 0
  } catch {
    return false
  }
}

async function checkCommunityDatabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyDomain: string
): Promise<{ email: string; type: 'personal' | 'generic' } | null> {
  // Prefer personal emails first
  const { data: personal } = await supabase
    .from('community_emails')
    .select('email, email_type, verified_count')
    .eq('company_domain', companyDomain)
    .eq('email_type', 'personal')
    .gte('verified_count', 1)
    .order('verified_count', { ascending: false })
    .limit(1)
    .single()

  if (personal) return { email: personal.email, type: 'personal' }

  // Fallback to generic
  const { data: generic } = await supabase
    .from('community_emails')
    .select('email, email_type, verified_count')
    .eq('company_domain', companyDomain)
    .eq('email_type', 'generic')
    .gte('verified_count', 3)
    .order('verified_count', { ascending: false })
    .limit(1)
    .single()

  if (generic) return { email: generic.email, type: 'generic' }

  return null
}

async function tryPatternGuessing(companyDomain: string): Promise<string | null> {
  for (const pattern of EMAIL_PATTERNS) {
    const email = pattern.replace('{domain}', companyDomain)
    console.log('Trying pattern:', email)
    const isValid = await verifyEmailViaDNS(email)
    if (isValid) {
      console.log('Found valid email:', email)
      return email
    }
  }
  return null
}

async function saveToCommunityDB(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyDomain: string,
  companyName: string,
  email: string
) {
  try {
    const { data: existing } = await supabase
      .from('community_emails')
      .select('id')
      .eq('company_domain', companyDomain)
      .eq('email', email)
      .single()

    if (existing) return

    const { error } = await supabase
      .from('community_emails')
      .insert({
        company_domain: companyDomain,
        company_name: companyName,
        email,
        email_type: 'generic',
        verified_count: 1,
        failed_count: 0,
      })

    if (error) console.error('Error saving to community DB:', error)
  } catch {
    // ignore
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { job_id, company_domain } = FindEmailSchema.parse(body)

    const supabase = await createClient()

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    let foundEmail: string | null = null
    let source: 'community' | 'pattern' = 'community'
    let emailType: 'personal' | 'generic' = 'generic'

    console.log('Step 1: Checking community database...')
    const communityResult = await checkCommunityDatabase(supabase, company_domain)

    if (communityResult) {
      console.log('Found in community DB:', communityResult.email, `(${communityResult.type})`)
      foundEmail = communityResult.email
      source = 'community'
      emailType = communityResult.type
    } else {
      console.log('Step 2: Trying pattern guessing...')
      foundEmail = await tryPatternGuessing(company_domain)

      if (foundEmail) {
        source = 'pattern'
        emailType = 'generic'
        await saveToCommunityDB(supabase, company_domain, job.company_name, foundEmail)
      }
    }

    if (!foundEmail) {
      return NextResponse.json({
        success: false,
        message: 'Email not found. Try manual entry or add your Hunter.io API key in settings.',
        email: null,
        source: null,
      })
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        hr_email: foundEmail,
        email_source: source,
        email_type: emailType,
        status: 'email_found',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job_id)

    if (updateError) {
      console.error('Error updating job:', updateError)
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Email found via ${source}!`,
      email: foundEmail,
      source,
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Email finding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
