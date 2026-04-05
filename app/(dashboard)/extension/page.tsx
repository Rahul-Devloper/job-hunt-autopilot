'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/dashboard/header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Chrome, Check, Copy, Trash2, AlertTriangle } from 'lucide-react'

interface ExtensionToken {
  id: string
  token: string
  device_name: string
  created_at: string
  last_used_at: string | null
  expires_at: string
}

export default function ExtensionPage() {
  const [tokens, setTokens] = useState<ExtensionToken[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [deviceName, setDeviceName] = useState('Chrome Extension')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadTokens()
  }, [])

  async function loadTokens() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data } = await supabase
        .from('extension_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .order('created_at', { ascending: false })

      setTokens(data || [])
    }

    setLoading(false)
  }

  async function generateToken() {
    setGenerating(true)
    setNewToken(null)

    try {
      const response = await fetch('/api/extension/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_name: deviceName }),
      })

      const result = await response.json()

      if (result.success) {
        setNewToken(result.token)

        // Send token to extension if installed
        window.postMessage({ type: 'JHA_SET_EXTENSION_TOKEN', token: result.token }, '*')

        await loadTokens()
        setDeviceName('Chrome Extension')
      } else {
        alert('Failed to generate token: ' + result.error)
      }
    } catch {
      alert('Error generating token')
    } finally {
      setGenerating(false)
    }
  }

  async function revokeToken(tokenId: string) {
    if (
      !confirm(
        'Are you sure you want to revoke this token?\n\nThe extension will stop working until you generate a new token.'
      )
    ) {
      return
    }

    const supabase = createClient()
    await supabase.from('extension_tokens').update({ revoked: true }).eq('id', tokenId)

    await loadTokens()
  }

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getDaysUntilExpiration(expiresAt: string): number {
    const now = new Date()
    const expires = new Date(expiresAt)
    return Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  function getExpiryColor(daysLeft: number): string {
    if (daysLeft <= 3) return 'text-red-600'
    if (daysLeft <= 7) return 'text-orange-600'
    return 'text-gray-500'
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Extension Setup" description="Connect your Chrome extension" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Extension Setup" description="Connect your Chrome extension" />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl space-y-6">
          {/* Generate New Token */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="h-5 w-5" />
                Generate Extension Token
              </CardTitle>
              <CardDescription>
                Create a secure token to connect your Chrome extension (valid for 90 days)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="device-name">Device Name (Optional)</Label>
                <Input
                  id="device-name"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g., Work Laptop, Home Desktop"
                />
              </div>

              <Button onClick={generateToken} disabled={generating} className="w-full">
                {generating ? 'Generating Token...' : 'Generate New Token'}
              </Button>

              {newToken && (
                <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                  <div className="flex items-start gap-2 mb-3">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900">Token Generated Successfully!</p>
                      <p className="text-sm text-green-700 mt-1">
                        Token has been automatically sent to your extension. Valid for 90 days.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-white p-3 text-xs text-green-900 border border-green-300 font-mono overflow-x-auto">
                      {newToken}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToken(newToken)}
                      className="flex-shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800 border border-blue-200">
                <p className="font-medium mb-2">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Click &quot;Generate New Token&quot; above</li>
                  <li>Token is automatically sent to your Chrome extension</li>
                  <li>Go to any LinkedIn job posting</li>
                  <li>Click the &quot;Capture Job&quot; button to save jobs</li>
                  <li>Token expires in 90 days (you&apos;ll get a warning at 7 days)</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Active Tokens */}
          <Card>
            <CardHeader>
              <CardTitle>Active Tokens</CardTitle>
              <CardDescription>Manage your extension authentication tokens</CardDescription>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <div className="text-center py-12">
                  <Chrome className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No active tokens</p>
                  <p className="text-sm text-gray-400">
                    Generate a token above to connect your extension
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tokens.map((token) => {
                    const daysLeft = getDaysUntilExpiration(token.expires_at)
                    const isExpiringSoon = daysLeft <= 7
                    const expiryColor = getExpiryColor(daysLeft)

                    return (
                      <div
                        key={token.id}
                        className={`flex items-center justify-between rounded-lg border p-4 ${
                          isExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{token.device_name}</p>
                            {isExpiringSoon && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="h-3 w-3" />
                                Expiring Soon
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            Created: {new Date(token.created_at).toLocaleDateString()}
                          </p>
                          {token.last_used_at && (
                            <p className="text-xs text-gray-400">
                              Last used: {new Date(token.last_used_at).toLocaleString()}
                            </p>
                          )}
                          <p className={`text-sm font-medium mt-1 ${expiryColor}`}>
                            {daysLeft <= 0
                              ? 'Expired'
                              : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToken(token.token)}
                            title="Copy token"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => revokeToken(token.id)}
                            title="Revoke token"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
