'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/dashboard/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Mail } from 'lucide-react'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [gmailConnected, setGmailConnected] = useState(false)
  const [yahooEmail, setYahooEmail] = useState('')
  const [yahooPassword, setYahooPassword] = useState('')
  const [yahooSaved, setYahooSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (searchParams.get('gmail') === 'connected') {
      setGmailConnected(true)
      alert('Gmail connected successfully!')
    }
    if (searchParams.get('error')) {
      const err = searchParams.get('error')
      alert(`Failed to connect Gmail: ${err}. Please try again.`)
    }
  }, [searchParams])

  function handleConnectGmail() {
    window.location.href = '/api/auth/gmail'
  }

  async function handleSaveYahoo() {
    if (!yahooEmail || !yahooPassword) {
      alert('Please enter both email and app password')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/settings/yahoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yahoo_email: yahooEmail, yahoo_password: yahooPassword }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save')

      setYahooSaved(true)
      setYahooPassword('')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save Yahoo credentials')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Settings" description="Configure your account and integrations" />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl space-y-6">
          {/* Gmail */}
          <Card>
            <CardHeader>
              <CardTitle>Gmail Integration</CardTitle>
              <CardDescription>
                Connect your Gmail account to send cold emails directly from the app
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gmailConnected ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Gmail Connected</span>
                </div>
              ) : (
                <Button onClick={handleConnectGmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Connect Gmail
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Yahoo */}
          <Card>
            <CardHeader>
              <CardTitle>Yahoo Email Integration</CardTitle>
              <CardDescription>
                Send emails via Yahoo SMTP using an app-specific password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {yahooSaved && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  <Check className="h-4 w-4 shrink-0" />
                  Yahoo credentials saved — Yahoo is now your active email provider
                </div>
              )}

              <div>
                <Label htmlFor="yahoo-email">Yahoo Email</Label>
                <Input
                  id="yahoo-email"
                  type="email"
                  placeholder="you@yahoo.com"
                  value={yahooEmail}
                  onChange={(e) => setYahooEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="yahoo-password">App Password</Label>
                <Input
                  id="yahoo-password"
                  type="password"
                  placeholder="16-character app password"
                  value={yahooPassword}
                  onChange={(e) => setYahooPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Generate an app password at{' '}
                  <a
                    href="https://login.yahoo.com/account/security"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Yahoo Account Security
                  </a>
                  . Requires 2FA to be enabled on your Yahoo account.
                </p>
              </div>

              <Button onClick={handleSaveYahoo} disabled={saving}>
                {saving ? 'Saving...' : 'Save & Switch to Yahoo'}
              </Button>
            </CardContent>
          </Card>

          {/* Email Finding */}
          <Card>
            <CardHeader>
              <CardTitle>Email Finding (Optional)</CardTitle>
              <CardDescription>
                Add Hunter.io or Apollo.io API keys for personal email finding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Coming in a future update! For now we use the free community database and pattern
                guessing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
