import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_BACKGROUND } from '@/lib/default-background'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { jobId, contactName } = await request.json()

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'jobId required' },
        { status: 400 },
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[Draft] GEMINI_API_KEY not configured')
      return NextResponse.json(
        { success: false, error: 'AI not configured' },
        { status: 503 },
      )
    }

    const supabase = await createClient()

    const [{ data: job }, { data: settings }] = await Promise.all([
      supabase
        .from('jobs')
        .select('job_title, company_name, job_description')
        .eq('id', jobId)
        .eq('user_id', auth.userId)
        .single(),
      supabase
        .from('user_settings')
        .select('professional_summary, full_name, contact_line')
        .eq('user_id', auth.userId)
        .single(),
    ])

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 },
      )
    }

    const background = settings?.professional_summary || DEFAULT_BACKGROUND
    const jobDesc = (job.job_description || '').slice(0, 1200)
    const name = contactName || null
    const applicantName =
      settings?.full_name || (auth.email ? auth.email.split('@')[0] : 'Applicant')
    const contactLine = settings?.contact_line || ''

    const prompt = `Draft a cold outreach job application email. Truthful, skimmable, and human.

⚠️ TOP PRIORITY — HONESTY (overrides everything below)
These rules are absolute. If any other instruction conflicts, HONESTY WINS:
- Use the EXACT years of experience from the background. Never round up, never inflate.
- Only mention technologies that appear ANYWHERE in the applicant's full background (summary, skills, OR education). Never invent a tech — but DO use any real skill listed, even if it only appears in the skills or education section, not the summary.
- Only include metrics/numbers that appear in the background. Never invent numbers or scale.
- Never claim leadership, mentorship, or management the applicant doesn't have.
- If the job needs something the applicant genuinely lacks (not in ANY section), either omit it or acknowledge it honestly — never fake it. Do NOT apologize for a skill the applicant actually has listed somewhere.
Every claim must be grounded in the applicant's real, stated background.

TONE
- Direct, warm, human. Write like a real person, not a cover letter.
- BANNED filler: "thrive in fast-paced environments", "passionate about", "my background aligns", "I am writing to express my interest", "deeply resonates", "I am confident that", "enterprise-grade" / "high-scale" (unless literally true and stated in the background).

STRUCTURE (follow exactly)
Subject: ${job.job_title} - ${applicantName}

Hi ${name ? '[contact first name]' : `${job.company_name} Team`},

[1 sentence: the role being applied for.]
[1 sentence: a genuine, SPECIFIC nod to the company's mission or tech — not generic praise.]

[1 line: exact years of experience + core value proposition. If experience is below what the role asks, address it confidently and truthfully, referencing only REAL projects.]

Here's what I bring:
- [Bullet 1: a real skill/proof mapped DIRECTLY to a top job requirement. Bold the key phrase with **markdown**. Include a metric ONLY if it exists in the background.]
- [Bullet 2: same, mapped to another requirement. Emphasize job-description keywords the applicant GENUINELY has.]
- [Bullet 3: same, mapped to another requirement. Focus on real impact — what was built and shipped.]

[1 sentence: specific, light call to action.]

Best,
${applicantName}
${contactLine || '(no contact line provided — omit this line entirely, do not print a blank line or placeholder)'}

BULLET RULES
- Each bullet must be specific to the applicant's real work — no generic filler.
- Map each bullet to an actual requirement in the job description.
- Prioritize job-description keywords the applicant TRULY has (check ALL sections); never surface a keyword they lack.

INPUTS
1. Applicant's full background (SOURCE OF TRUTH — every fact must come from here):
${background}

2. Applicant name: ${applicantName}
3. Contact line: ${contactLine || '(none)'}
4. Job role: ${job.job_title}
5. Company: ${job.company_name}
6. Job description: ${jobDesc}

${name ? `Contact name: ${name}` : ''}

Write the email now. Sharp, truthful, human. Return JSON with "subject" and "body" — put the bullets inside the body string using \\n line breaks and • characters.`

    const ai = new GoogleGenAI({ apiKey })

    try {
      const timeoutMs = 15000
      const draftPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          thinkingConfig: {
            thinkingBudget: 0, // disable thinking — email drafting doesn't need it
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING },
            },
            required: ['subject', 'body'],
          },
        },
      })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Gemini request timed out')),
          timeoutMs,
        ),
      )

      const response = await Promise.race([draftPromise, timeoutPromise])

      // Log full response so we can diagnose issues during testing
      console.log('[Draft] Full response:', JSON.stringify(response, null, 2))

      const candidate = response.candidates?.[0]
      const finishReason = candidate?.finishReason
      console.log('[Draft] finishReason:', finishReason)

      if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
        console.error('[Draft] Blocked by Gemini:', finishReason)
        return ApiResponseBuilder.error('AI draft unavailable — using template')
      }

      const text = response.text
      if (!text || text.trim().length === 0) {
        console.error('[Draft] Empty text. finishReason:', finishReason)
        return ApiResponseBuilder.error('AI draft unavailable — using template')
      }

      let parsed: { subject?: string; body?: string }
      try {
        parsed = JSON.parse(text)
      } catch {
        console.error('[Draft] Parse failed. Raw text:', text)
        return ApiResponseBuilder.error('AI draft unavailable — using template')
      }

      if (!parsed.subject || !parsed.body) {
        console.error('[Draft] Missing subject/body:', parsed)
        return ApiResponseBuilder.error('AI draft unavailable — using template')
      }

      const body = parsed.body
        .replace(/([.!?])([A-Z])/g, '$1 $2')  // space after sentence-ending punctuation
        .replace(/,([A-Za-z])/g, ', $1')       // space after comma
        .replace(/\n{3,}/g, '\n\n')            // collapse 3+ newlines to 2
        .trim()

      const subject = parsed.subject.trim()

      return ApiResponseBuilder.success({ subject, body })
    } catch (geminiErr) {
      console.error(
        '[Draft] Gemini error:',
        geminiErr instanceof Error ? geminiErr.message : geminiErr,
      )
      return ApiResponseBuilder.error('Failed to generate draft')
    }
  } catch (error) {
    console.error(
      '[Draft] Unexpected error:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { success: false, error: 'Failed to generate draft' },
      { status: 500 },
    )
  }
}
