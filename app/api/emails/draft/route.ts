import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { AuthService } from '@/lib/auth/auth-service'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_SUMMARY =
  'Full-stack developer with 3 years of commercial experience across React, TypeScript, Node.js, Next.js, and PostgreSQL. Built and shipped Job Hunt Autopilot (a live full-stack SaaS with a Chrome extension, OAuth, and multi-provider email integration) and MedTrust (React/Node/MongoDB). MSc in Web & Mobile Development (Distinction). Self-taught transition from mechanical engineering into software. Relocating to India (Bangalore/Chennai/Hyderabad) August 2026.'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { jobId, contactName, contactRole } = await request.json()

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

    const professionalSummary =
      settings?.professional_summary || DEFAULT_SUMMARY
    const jobDesc = (job.job_description || '').slice(0, 1000)
    const name = contactName || null
    const role = contactRole || 'Hiring Contact'
    const applicantName =
      settings?.full_name || (auth.email ? auth.email.split('@')[0] : 'Applicant')
    const contactLine = settings?.contact_line || ''

    const prompt = `You are drafting a cold outreach job application email. It must be punchy, skimmable, human, and 100% truthful. A recruiter reads it in 7 seconds — structure for skimming.

═══ TONE ═══

Direct, warm, authentic. Write like a real person, not a cover letter. Natural warmth is good ("really cool", "would love to chat") — but not forced. NO corporate filler. BANNED phrases:
"I am writing to express my interest", "my background aligns", "deeply resonates", "thrive in fast-paced environments", "I am confident that", "I am a great fit", "passionate about".

═══ STRUCTURE (follow exactly) ═══
Subject: ${job.job_title} - ${applicantName}

Hi ${name ? '[contact first name]' : `[${job.company_name}] Team`},

[2 sentences: the role you're applying for + a genuine, specific nod to the company's tech or mission. Not generic flattery — something real about them.]

[1 line: years of experience + core value proposition.]

Here's what I bring:

[Bullet 1 — a key skill/proof that maps DIRECTLY to a top job requirement]
[Bullet 2 — same, mapped to another requirement]
[Bullet 3 — same, mapped to another requirement]

[1-sentence sign-off with a light call to action.]

Best,
${applicantName}
${contactLine || '(no contact line provided — omit this line entirely, do not print a blank line or placeholder)'}

═══ HONESTY RULES (NON-NEGOTIABLE — violating these is failure) ═══

Use EXACTLY the years of experience in the summary below. Never round up, never inflate.
Only mention technologies that appear in the applicant's summary below.
NEVER invent a tech (no Django, no Python, no anything) that isn't listed.
If the job requires something the applicant lacks, DO NOT claim it.
Either omit it or acknowledge it honestly in one short line.
Every bullet must be grounded in the applicant's real, stated experience.
No embellishment ("high-scale", "enterprise-grade") unless it's literally true.

═══ BULLET RULES ═══

Bullets must be SPECIFIC to this applicant's real work, not generic
("advocate for clean code" is filler — cut it).
Map each bullet to an actual requirement from the job description.
Bold the key phrase in each bullet using markdown (**phrase**).

═══ INPUTS ═══
Applicant's professional summary (SOURCE OF TRUTH — only use facts from here):
${professionalSummary}

Applicant name: ${applicantName}
Contact line (links/phone to append): ${contactLine || '(none)'}

Job role: ${job.job_title}
Company: ${job.company_name}
Job description: ${jobDesc}

Contact name: ${name || '(none — address the company/team generically)'}
Contact role: ${role}

Write the email now. Truthful, skimmable, human. Return JSON with "subject" and "body" — put the bullets inside the body string using \\n line breaks and • characters.`

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
