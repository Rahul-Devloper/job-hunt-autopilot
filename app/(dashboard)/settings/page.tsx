'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/dashboard/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Mail } from 'lucide-react'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [gmailConnected, setGmailConnected] = useState(false)

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

  return (
    <div className="flex h-full flex-col">
      <Header title="Settings" description="Configure your account and integrations" />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl space-y-6">
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
