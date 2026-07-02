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
        .select('professional_summary')
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
    const jobDesc = (job.job_description || '').slice(0, 800)
    const name = contactName || 'Hiring Manager'
    const role = contactRole || 'Hiring Contact'

    const prompt = `You are drafting a cold outreach email for a job applicant reaching out directly to a hiring contact. Write in a direct, genuine, slightly formal tone. Follow these rules strictly:

STYLE RULES:
- Open with what the applicant has DONE, not who they are.
- No filler phrases, no hollow corporate language.
- Lead with concrete proof points and specifics from their background.
- If there's an honest gap relative to the role, acknowledge it directly rather than hiding it.
- Keep it concise — 120-160 words for the body.
- Clean, professional sign-off.
- Address the contact by first name only.
- Always put a space after every period. Never run sentences together.

STRUCTURE RULES:
- Start with a greeting: "Hi [contact's first name],"
- Blank line, then the opening paragraph.
- Use 2-3 SHORT paragraphs (2-3 sentences each), separated by blank lines.
- Sign off on its own lines: "Best regards," then the applicant's first name on the next line.
- Use actual line breaks (\\n) between paragraphs — the body must read as a properly formatted email, NOT a single block.

Body structure to follow exactly:
Hi [First Name],

[Opening — what the applicant has built, concrete and specific.]

[Middle — why this maps to THIS role at THIS company.]

[Brief, honest note on any gap if relevant.]

Best regards,
[Applicant first name]

BANNED PHRASES (never use these — they are hollow filler):
- "my background aligns" / "my background aligns well with"
- "I believe my background"
- "I am writing to express my interest"
- "I am a good fit" / "I would be a great fit"
- "I am confident that"
Replace all of these with direct, concrete statements about what the applicant has actually done.

APPLICANT'S PROFESSIONAL SUMMARY:
${professionalSummary}

JOB DETAILS:
- Role: ${job.job_title}
- Company: ${job.company_name}
- Job description (context): ${jobDesc}

CONTACT:
- Name: ${name}
- Role: ${role}

TASK:
Write a personalized cold email from the applicant to this contact about this specific role. Reference the company and role naturally. Make it feel hand-written, not templated.`

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
