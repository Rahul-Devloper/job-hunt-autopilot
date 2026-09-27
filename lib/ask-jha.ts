import { GoogleGenAI, Type } from '@google/genai'
import { findRelevantJobs, type MatchedJob } from '@/lib/retrieval'

export interface JobSource {
  id: string
  job_title: string
  company_name: string
  status: MatchedJob['status']
}

export interface AskJHAResult {
  answer: string
  sources: JobSource[]
}

const NO_MATCH_ANSWER =
  "I don't have any saved jobs that match that. Try rephrasing, or this might genuinely not be in your tracked jobs yet."

function toSource(job: MatchedJob): JobSource {
  return { id: job.id, job_title: job.job_title, company_name: job.company_name, status: job.status }
}

function buildPrompt(question: string, jobs: MatchedJob[]): string {
  const context = jobs
    .map(
      (job, i) =>
        `[Job ${i + 1}] ${job.job_title} at ${job.company_name}\n${job.job_description || '(no description available)'}`,
    )
    .join('\n\n---\n\n')

  return `You are Ask JHA, a job search assistant. Answer the question below using ONLY the job postings provided as context. Never use outside knowledge about companies, technologies, or the job market — everything you say must be traceable to the text below.

⚠️ CRITICAL — RETRIEVAL IS NOT CONFIRMATION
These jobs were found by semantic similarity search, which means they are topically related to the question — it does NOT mean their text actually confirms what's being asked. A job about full-stack engineering can be topically close to a question about a specific technology (e.g. Kafka, Terraform, a specific framework) WITHOUT that technology ever being mentioned in the job's actual text.

For EACH job below, before using it to answer:
1. Actually check whether the job's text contains the specific thing the question asks about (a skill, technology, requirement, location, salary detail, etc.) — read it, don't assume.
2. If a job is topically related but does NOT actually mention/confirm the specific detail asked, say so explicitly in your answer (e.g. "The [Job Title] role at [Company] is a similar full-stack position, but the description doesn't specifically mention Kafka"). Never present a topically-similar job as if it confirms something it doesn't.
3. If NONE of the jobs below actually contain information that answers the question, say clearly that none of your saved jobs address it. Do not guess, do not fill the gap with general knowledge about the tech industry.

JOBS:
${context}

QUESTION: ${question}

Write a direct, honest answer (2-5 sentences). Return JSON with a single "answer" field.`
}

/**
 * Answers `question` grounded only in the user's own saved jobs. If findRelevantJobs() returns
 * nothing, this returns a direct "no match" answer WITHOUT calling Gemini at all — letting the
 * model answer from its own general knowledge when nothing relevant was retrieved is exactly the
 * hallucination risk this function exists to prevent. Never throws.
 */
export async function askJHA(question: string): Promise<AskJHAResult> {
  const jobs = await findRelevantJobs(question)

  if (jobs.length === 0) {
    console.log('[AskJHA] No relevant jobs retrieved — skipping Gemini call')
    return { answer: NO_MATCH_ANSWER, sources: [] }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[AskJHA] GEMINI_API_KEY not configured')
    return { answer: "I couldn't generate an answer right now — AI isn't configured.", sources: [] }
  }

  const prompt = buildPrompt(question, jobs)
  const ai = new GoogleGenAI({ apiKey })

  try {
    const timeoutMs = 15000
    const genPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2, // lower than drafting (0.7) — this is factual grounding, not creative writing
        maxOutputTokens: 1024,
        thinkingConfig: {
          thinkingBudget: 0,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
          },
          required: ['answer'],
        },
      },
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini request timed out')), timeoutMs),
    )

    const response = await Promise.race([genPromise, timeoutPromise])

    const candidate = response.candidates?.[0]
    const finishReason = candidate?.finishReason
    console.log('[AskJHA] finishReason:', finishReason)

    if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
      console.error('[AskJHA] Blocked by Gemini:', finishReason)
      return { answer: "I couldn't generate an answer for that question.", sources: [] }
    }

    const text = response.text
    if (!text || text.trim().length === 0) {
      console.error('[AskJHA] Empty text. finishReason:', finishReason)
      return { answer: "I couldn't generate an answer for that question.", sources: [] }
    }

    let parsed: { answer?: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[AskJHA] Parse failed. Raw text:', text)
      return { answer: "I couldn't generate an answer for that question.", sources: [] }
    }

    if (!parsed.answer) {
      console.error('[AskJHA] Missing answer field:', parsed)
      return { answer: "I couldn't generate an answer for that question.", sources: [] }
    }

    return { answer: parsed.answer.trim(), sources: jobs.map(toSource) }
  } catch (error) {
    console.error('[AskJHA] Gemini error:', error instanceof Error ? error.message : error)
    return { answer: "I couldn't generate an answer right now — please try again.", sources: [] }
  }
}
