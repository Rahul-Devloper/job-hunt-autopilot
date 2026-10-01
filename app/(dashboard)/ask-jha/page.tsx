'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { statusColors } from '@/components/dashboard/job-card'

interface JobSource {
  id: string
  job_title: string
  company_name: string
  status: string
}

interface AskJHAResponse {
  answer: string
  sources: JobSource[]
}

const EXAMPLE_QUESTIONS = [
  'Which jobs need React and TypeScript experience?',
  'Which jobs are for backend engineering roles?',
  'Which jobs mention remote work?',
]

export default function AskJHAPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskJHAResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasAsked, setHasAsked] = useState(false)

  async function handleAsk(q?: string) {
    const finalQuestion = (q ?? question).trim()
    if (!finalQuestion || loading) return

    setLoading(true)
    setError(null)
    setHasAsked(true)

    try {
      const res = await fetch('/api/ask-jha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: finalQuestion }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Something went wrong — try again.')
        setResult(null)
      } else {
        setResult(json.data)
      }
    } catch {
      setError('Could not reach the server — check your connection and try again.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Ask JHA" description="Ask questions about your saved jobs — answered from your own data" />

      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Textarea
                placeholder="e.g. Which jobs need AWS experience?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAsk()
                  }
                }}
                rows={3}
                maxLength={500}
                disabled={loading}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Enter to ask, Shift+Enter for a new line
                </p>
                <Button onClick={() => handleAsk()} disabled={loading || !question.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Ask
                    </>
                  )}
                </Button>
              </div>

              {!hasAsked && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setQuestion(q)
                        handleAsk(q)
                      }}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {loading && (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  Searching your saved jobs and generating an answer — this takes a few seconds...
                </span>
              </CardContent>
            </Card>
          )}

          {!loading && error && (
            <Card className="border-destructive/50">
              <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          {!loading && !error && result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Answer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{result.answer}</p>

                {result.sources.length > 0 ? (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Based on {result.sources.length} saved job{result.sources.length === 1 ? '' : 's'}:
                    </p>
                    <div className="space-y-2">
                      {result.sources.map((source) => (
                        <div
                          key={source.id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{source.job_title}</p>
                            <p className="truncate text-xs text-muted-foreground">{source.company_name}</p>
                          </div>
                          <Badge className={cn('shrink-0 capitalize', statusColors[source.status])}>
                            {source.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    <ExternalLink className="mx-auto mb-2 h-4 w-4" />
                    No saved jobs matched this question — try a different question, or this
                    genuinely isn&apos;t something in your tracked jobs yet.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
