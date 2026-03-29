'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/dashboard/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { TrendingUp, Mail, Eye, MousePointerClick, Target, Flame } from 'lucide-react'

interface AnalyticsData {
  overview: {
    totalJobs: number
    emailFoundJobs: number
    totalEmailsSent: number
    totalOpened: number
    totalClicked: number
    openRate: number
    clickRate: number
  }
  topCompanies: Array<{ company: string; clicks: number; job_title: string }>
  hotLeads: Array<{ company: string; clicks: number; job_title: string }>
  timeline: Array<{ date: string; sent: number; opened: number; clicked: number }>
  funnel: Array<{ stage: string; count: number }>
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Analytics" description="Track your job hunt performance" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Analytics" description="Track your job hunt performance" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Failed to load analytics</p>
        </div>
      </div>
    )
  }

  const { overview, topCompanies, hotLeads, timeline, funnel } = data

  return (
    <div className="flex h-full flex-col">
      <Header title="Analytics" description="Track your job hunt performance" />

      <div className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                <Target className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalJobs}</div>
                <p className="text-xs text-gray-500">{overview.emailFoundJobs} email found</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                <Mail className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalEmailsSent}</div>
                <p className="text-xs text-gray-500">{overview.emailFoundJobs} emails found</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                <Eye className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.openRate}%</div>
                <p className="text-xs text-gray-500">
                  {overview.totalOpened} / {overview.totalEmailsSent} opened
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                <MousePointerClick className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.clickRate}%</div>
                <p className="text-xs text-gray-500">
                  {overview.totalClicked} / {overview.totalEmailsSent} clicked
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Hot Leads */}
          {hotLeads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Hot Leads (3+ clicks)
                </CardTitle>
                <CardDescription>Companies showing strong interest</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {hotLeads.map(lead => (
                    <div
                      key={lead.company}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{lead.company}</p>
                        <p className="text-sm text-gray-500">{lead.job_title}</p>
                      </div>
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
                        {lead.clicks} clicks 🔥
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Job hunt pipeline progression</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="stage" width={100} />
                    <Tooltip />
                    <Bar dataKey="count">
                      {funnel.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Companies */}
            <Card>
              <CardHeader>
                <CardTitle>Top Companies by Engagement</CardTitle>
                <CardDescription>Most LinkedIn clicks</CardDescription>
              </CardHeader>
              <CardContent>
                {topCompanies.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCompanies}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="company" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-gray-500">
                    No click data yet. Send some emails!
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline (Last 30 Days)</CardTitle>
              <CardDescription>Emails sent, opened, and clicked over time</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={date =>
                        new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={date =>
                        new Date(date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      }
                    />
                    <Legend />
                    <Line type="monotone" dataKey="sent" stroke="#3b82f6" name="Sent" />
                    <Line type="monotone" dataKey="opened" stroke="#10b981" name="Opened" />
                    <Line type="monotone" dataKey="clicked" stroke="#f59e0b" name="Clicked" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-gray-500">
                  No activity in the last 30 days
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Open Rate</span>
                    <span className="text-sm text-gray-500">{overview.openRate}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-green-500 transition-all"
                      style={{ width: `${Math.min(overview.openRate, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {overview.openRate >= 50
                      ? '✅ Great! Above average'
                      : '⚠️ Below 50% — try different subject lines'}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Click Rate</span>
                    <span className="text-sm text-gray-500">{overview.clickRate}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(overview.clickRate, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {overview.clickRate >= 30
                      ? '✅ Excellent engagement!'
                      : overview.clickRate >= 15
                      ? '👍 Good engagement'
                      : '💡 Add more value in emails'}
                  </p>
                </div>

                <div className="rounded-lg bg-blue-50 p-4">
                  <h4 className="mb-2 font-medium text-blue-900">📊 Key Metrics</h4>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>
                      •{' '}
                      {overview.totalEmailsSent > 0
                        ? `${overview.clickRate}% of emails got LinkedIn clicks`
                        : 'No emails sent yet'}
                    </li>
                    <li>
                      •{' '}
                      {hotLeads.length > 0
                        ? `${hotLeads.length} hot lead${hotLeads.length > 1 ? 's' : ''} (3+ clicks) 🔥`
                        : 'No hot leads yet'}
                    </li>
                    <li>
                      •{' '}
                      {topCompanies.length > 0
                        ? `Top performer: ${topCompanies[0].company} (${topCompanies[0].clicks} clicks)`
                        : 'Send more emails to see top performers'}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
