import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/auth-service'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_SUMMARY =
  'Full-stack developer with 3 years of commercial experience across React, TypeScript, Node.js, Next.js, and PostgreSQL. Built and shipped Job Hunt Autopilot (a live full-stack SaaS with a Chrome extension, OAuth, and multi-provider email integration) and MedTrust (React/Node/MongoDB). MSc in Web & Mobile Development (Distinction). Self-taught transition from mechanical engineering into software. Relocating to India (Bangalore/Chennai/Hyderabad) August 2026.'

export async function POST(request: Request) {
  try {
    const auth = await AuthService.authenticateCookie()
    const { jobId, contactName, contactRole } = await request.json()

    if (!jobId) {
      return NextResponse.json({ success: false, error: 'jobId required' }, { status: 400 })
    }

    const supabase = await createClient()

    const [{ data: job }, { data: settings }] = await Promise.all([
      supabase.from('jobs').select('job_title, company_name, job_description').eq('id', jobId).eq('user_id', auth.userId).single(),
      supabase.from('user_settings').select('professional_summary').eq('user_id', auth.userId).single(),
    ])

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    const professionalSummary = settings?.professional_summary || DEFAULT_SUMMARY
    const jobDesc = (job.job_description || '').slice(0, 800)
    const name = contactName || 'Hiring Manager'
    const role = contactRole || 'Hiring Contact'

    const prompt = `You are drafting a cold outreach email for a job applicant reaching out directly to a hiring contact. Write in a direct, genuine, slightly formal tone. Follow these rules strictly:

STYLE RULES:
- Open with what the applicant has DONE, not who they are. No "I am writing to express my interest" or "I believe my background aligns."
- No filler phrases, no hollow corporate language.
- Lead with concrete proof points and specifics from their background.
- If there's an honest gap relative to the role, acknowledge it directly rather than hiding it.
- Keep it concise — 120-160 words for the body.
- Clean, professional sign-off.
- Address the contact by first name only.

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
Write a personalized cold email from the applicant to this contact about this specific role. Reference the company and role naturally. Make it feel hand-written, not templated.

OUTPUT FORMAT (strict):
Return ONLY valid JSON, no markdown, no backticks:
{"subject": "...", "body": "..."}`

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[Draft] GEMINI_API_KEY not configured')
      return NextResponse.json({ success: false, error: 'AI not configured' }, { status: 503 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    let rawText = ''
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!geminiRes.ok) {
        const errText = await geminiRes.text()
        console.error('[Draft] Gemini API error:', geminiRes.status, errText.slice(0, 200))
        return NextResponse.json({ success: false, error: 'Gemini API error' }, { status: 502 })
      }

      const geminiData = await geminiRes.json()
      rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (fetchErr) {
      clearTimeout(timeoutId)
      if ((fetchErr as Error).name === 'AbortError') {
        return NextResponse.json({ success: false, error: 'Gemini request timed out' }, { status: 504 })
      }
      throw fetchErr
    }

    // Strip ```json fences if Gemini adds them despite instructions
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      return NextResponse.json({
        success: true,
        data: { subject: String(parsed.subject || ''), body: String(parsed.body || '') },
      })
    } catch {
      // Parsing failed — return raw text as body with generic subject
      console.warn('[Draft] Failed to parse Gemini JSON — returning raw text')
      return NextResponse.json({
        success: true,
        data: {
          subject: `${job.job_title} at ${job.company_name} — Application`,
          body: cleaned,
        },
      })
    }
  } catch (error) {
    console.error('[Draft] Unexpected error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, error: 'Failed to generate draft' }, { status: 500 })
  }
}
