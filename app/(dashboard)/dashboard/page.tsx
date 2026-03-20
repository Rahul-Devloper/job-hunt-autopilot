'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/dashboard/header'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Briefcase, Mail, Send, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    total: 0,
    captured: 0,
    emailFound: 0,
    emailSent: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('jobs').select('status')
      if (error) throw error

      const total = data.length
      const captured = data.filter((j) => j.status === 'captured').length
      const emailFound = data.filter((j) => j.status === 'email_found').length
      const emailSent = data.filter((j) => j.status === 'email_sent').length

      setStats({ total, captured, emailFound, emailSent })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      label: 'Total Jobs',
      value: stats.total,
      icon: Briefcase,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Captured',
      value: stats.captured,
      icon: TrendingUp,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
    {
      label: 'Email Found',
      value: stats.emailFound,
      icon: Mail,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Email Sent',
      value: stats.emailSent,
      icon: Send,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Dashboard"
        description="Overview of your job hunt progress"
        action={{
          label: 'View All Jobs',
          onClick: () => router.push('/jobs'),
        }}
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {loading ? '—' : stat.value}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {!loading && stats.total === 0 && (
          <Card className="mt-8 p-12 text-center border-dashed">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <Briefcase className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No jobs captured yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Install the Chrome extension and start capturing jobs from LinkedIn!
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
