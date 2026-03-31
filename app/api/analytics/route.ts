import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = createServiceClient()
    const userId = user.id

    const [jobsResult, emailsResult, clicksResult] = await Promise.all([
      supabase.from('jobs').select('*').eq('user_id', userId),
      supabase
        .from('emails_sent')
        .select('*, jobs(company_name, job_title, status)')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false }),
      supabase
        .from('link_clicks')
        .select('*, jobs(company_name, job_title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    if (jobsResult.error) throw jobsResult.error
    if (emailsResult.error) throw emailsResult.error
    if (clicksResult.error) throw clicksResult.error

    const jobs = jobsResult.data || []
    const emails = emailsResult.data || []
    const clicks = clicksResult.data || []

    const totalJobs = jobs.length
    const emailFoundJobs = jobs.filter(j =>
      ['email_found', 'email_sent'].includes(j.status)
    ).length
    const totalEmailsSent = emails.length
    const totalOpened = emails.filter(e => e.opened_at).length
    const totalClicked = emails.filter(e => e.clicked_at).length
    const openRate = totalEmailsSent > 0 ? Math.round((totalOpened / totalEmailsSent) * 100) : 0
    const clickRate = totalEmailsSent > 0 ? Math.round((totalClicked / totalEmailsSent) * 100) : 0

    // Top companies by total click_count
    const companyCounts: Record<string, { company: string; clicks: number; job_title: string }> = {}
    clicks.forEach(click => {
      const company = (click.jobs as { company_name?: string; job_title?: string } | null)?.company_name || 'Unknown'
      const title = (click.jobs as { company_name?: string; job_title?: string } | null)?.job_title || 'Unknown'
      if (!companyCounts[company]) {
        companyCounts[company] = { company, clicks: 0, job_title: title }
      }
      companyCounts[company].clicks += click.click_count || 1
    })

    const topCompanies = Object.values(companyCounts)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)

    const hotLeads = Object.values(companyCounts)
      .filter(c => c.clicks >= 3)
      .sort((a, b) => b.clicks - a.clicks)

    // Timeline: last 30 days grouped by date
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const timelineData: Record<string, { date: string; sent: number; opened: number; clicked: number }> = {}

    emails
      .filter(e => e.sent_at && new Date(e.sent_at) >= thirtyDaysAgo)
      .forEach(email => {
        const date = new Date(email.sent_at!).toISOString().split('T')[0]
        if (!timelineData[date]) timelineData[date] = { date, sent: 0, opened: 0, clicked: 0 }
        timelineData[date].sent += 1
        if (email.opened_at) timelineData[date].opened += 1
        if (email.clicked_at) timelineData[date].clicked += 1
      })

    const timeline = Object.values(timelineData).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const funnel = [
      { stage: 'Captured', count: totalJobs },
      { stage: 'Email Found', count: emailFoundJobs },
      { stage: 'Email Sent', count: totalEmailsSent },
      { stage: 'Opened', count: totalOpened },
      { stage: 'Clicked', count: totalClicked },
    ]

    return NextResponse.json({
      overview: {
        totalJobs,
        emailFoundJobs,
        totalEmailsSent,
        totalOpened,
        totalClicked,
        openRate,
        clickRate,
      },
      topCompanies,
      hotLeads,
      timeline,
      funnel,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
