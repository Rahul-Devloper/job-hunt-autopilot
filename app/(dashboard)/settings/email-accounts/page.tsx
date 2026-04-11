'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/dashboard/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Plus, Trash2, CheckCircle, XCircle, Star, Loader2, ExternalLink } from 'lucide-react'

interface EmailAccount {
  id: string
  email_address: string
  provider_name: string
  is_verified: boolean
  is_primary: boolean
  created_at: string
  last_used_at: string | null
  smtp_host: string
  smtp_port: number
}

interface SmtpProvider {
  name: string
  host: string
  port: number
  secure: boolean
  instructions: string
  setupUrl?: string
}

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  // Add account form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [detectedProvider, setDetectedProvider] = useState<SmtpProvider | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customHost, setCustomHost] = useState('')
  const [customPort, setCustomPort] = useState(587)
  const [customSecure, setCustomSecure] = useState(false)

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/email-accounts')
      const data = await response.json()
      if (data.success) {
        setAccounts(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    if (!email.includes('@')) {
      setDetectedProvider(null)
      return
    }

    const detect = async () => {
      try {
        const response = await fetch(
          `/api/email-accounts/detect-provider?email=${encodeURIComponent(email)}`
        )
        const data = await response.json()
        if (data.success) {
          setDetectedProvider(data.data.provider)
          if (!data.data.provider) setShowCustom(true)
        }
      } catch {
        // ignore
      }
    }

    detect()
  }, [email])

  async function addAccount() {
    if (!email || !password) {
      alert('Please enter email and password')
      return
    }

    setAdding(true)
    try {
      const payload: Record<string, unknown> = {
        email_address: email,
        password,
      }

      if (showCustom) {
        payload.smtp_host = customHost
        payload.smtp_port = customPort
        payload.smtp_secure = customSecure
      }

      const response = await fetch('/api/email-accounts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (data.success) {
        setEmail('')
        setPassword('')
        setShowCustom(false)
        setDetectedProvider(null)
        await loadAccounts()

        // Auto-test the new account
        if (data.data?.id) {
          testConnection(data.data.id)
        }
      } else {
        alert(data.error?.message || 'Failed to add email account')
      }
    } catch {
      alert('Failed to add email account')
    } finally {
      setAdding(false)
    }
  }

  async function testConnection(accountId: string) {
    setTesting(accountId)
    try {
      const response = await fetch('/api/email-accounts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Connection successful! Your email account is ready to use.')
        await loadAccounts()
      } else {
        alert('Connection failed: ' + (data.error?.message || 'Unknown error'))
      }
    } catch {
      alert('Connection test failed')
    } finally {
      setTesting(null)
    }
  }

  async function setPrimary(accountId: string) {
    try {
      const response = await fetch('/api/email-accounts/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      })

      const data = await response.json()
      if (data.success) await loadAccounts()
    } catch (error) {
      console.error('Failed to set primary:', error)
    }
  }

  async function deleteAccount(accountId: string) {
    if (
      !confirm(
        'Delete this email account?\n\nYou will need to reconnect it to send emails from this address.'
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) await loadAccounts()
    } catch (error) {
      console.error('Failed to delete account:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Email Accounts" description="Manage your email sending accounts" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  const needsAppPassword =
    detectedProvider?.name === 'Gmail' || detectedProvider?.name === 'Yahoo'

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Email Accounts"
        description="Send job applications from any email provider"
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl space-y-6">
          {/* Add Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Email Account
              </CardTitle>
              <CardDescription>
                Connect Gmail, Yahoo, Outlook, or any other email provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@provider.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {detectedProvider && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium text-blue-900">
                        {detectedProvider.name} detected!
                      </p>
                      <p className="text-sm text-blue-700">{detectedProvider.instructions}</p>
                      {detectedProvider.setupUrl && (
                        <a
                          href={detectedProvider.setupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          Setup instructions
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="password">
                  {needsAppPassword
                    ? 'App Password (NOT your regular password)'
                    : 'Password'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {needsAppPassword && (
                  <p className="text-xs text-amber-600 mt-1">
                    Use an App Password, not your regular password
                  </p>
                )}
              </div>

              {showCustom && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm font-medium">Custom SMTP Settings</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="smtp-host" className="text-xs">
                        SMTP Host
                      </Label>
                      <Input
                        id="smtp-host"
                        placeholder="smtp.example.com"
                        value={customHost}
                        onChange={(e) => setCustomHost(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-port" className="text-xs">
                        Port
                      </Label>
                      <Input
                        id="smtp-port"
                        type="number"
                        value={customPort}
                        onChange={(e) =>
                          setCustomPort(parseInt(e.target.value) || 587)
                        }
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="smtp-secure"
                      checked={customSecure}
                      onChange={(e) => setCustomSecure(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="smtp-secure" className="text-xs">
                      Use SSL (port 465)
                    </Label>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={addAccount}
                  disabled={!email || !password || adding}
                  className="flex-1"
                >
                  {adding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Account'
                  )}
                </Button>

                {!detectedProvider && email.includes('@') && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCustom(!showCustom)}
                  >
                    {showCustom ? 'Hide' : 'Custom SMTP'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account List */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>
                {accounts.length === 0
                  ? 'No email accounts connected yet'
                  : `${accounts.length} email account${accounts.length === 1 ? '' : 's'} connected`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No email accounts yet</p>
                  <p className="text-sm text-gray-400">
                    Add an account above to start sending emails
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        account.is_primary
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{account.email_address}</p>
                          {account.is_primary && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                              <Star className="h-3 w-3 fill-current" />
                              Primary
                            </span>
                          )}
                          {account.is_verified ? (
                            <span title="Verified">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </span>
                          ) : (
                            <span title="Not verified">
                              <XCircle className="h-4 w-4 text-amber-600" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {account.provider_name}
                          {account.last_used_at && (
                            <> · Last used {new Date(account.last_used_at).toLocaleDateString()}</>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {account.smtp_host}:{account.smtp_port}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {!account.is_verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testConnection(account.id)}
                            disabled={testing === account.id}
                          >
                            {testing === account.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Testing
                              </>
                            ) : (
                              'Test'
                            )}
                          </Button>
                        )}

                        {!account.is_primary && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPrimary(account.id)}
                          >
                            Set Primary
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteAccount(account.id)}
                          title="Delete account"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
