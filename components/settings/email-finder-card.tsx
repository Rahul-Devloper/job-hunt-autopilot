'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Check, Clock, ExternalLink, Trash2, Plus } from 'lucide-react'
import type { EmailFinderProviderInfo, EmailFinderStatus } from '@/types/email-finders'

interface EmailFinderCardProps {
  provider: EmailFinderProviderInfo
  status: EmailFinderStatus | null
  onSave: (providerId: string, credentials: Record<string, string>) => Promise<void>
  onRemove: (providerId: string) => Promise<void>
}

export function EmailFinderCard({ provider, status, onSave, onRemove }: EmailFinderCardProps) {
  const [showInput, setShowInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  // OAuth fields (Snov.io)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  // API key field (Hunter, GetProspect)
  const [apiKey, setApiKey] = useState('')

  const isConnected = status?.connected ?? false

  const tokenExpiresInMin =
    status?.token_expires_at
      ? Math.max(0, Math.floor((new Date(status.token_expires_at).getTime() - Date.now()) / 60000))
      : null

  async function handleSave() {
    let credentials: Record<string, string>

    if (provider.authType === 'oauth') {
      if (!clientId.trim() || !clientSecret.trim()) {
        alert(`Please enter both ${provider.credentialLabels.client_id} and ${provider.credentialLabels.client_secret}`)
        return
      }
      credentials = { client_id: clientId.trim(), client_secret: clientSecret.trim() }
    } else {
      if (!apiKey.trim()) {
        alert('Please enter your API key')
        return
      }
      credentials = { api_key: apiKey.trim() }
    }

    setSaving(true)
    try {
      await onSave(provider.id, credentials)
      setClientId('')
      setClientSecret('')
      setApiKey('')
      setShowInput(false)
    } catch (err) {
      alert(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${provider.name}? Your stored credentials will be deleted.`)) return
    setRemoving(true)
    try {
      await onRemove(provider.id)
    } catch {
      alert(`Failed to remove ${provider.name}`)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className={isConnected ? 'border-green-200 bg-green-50/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600">
              {provider.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {provider.name}
                <Badge variant="outline" className="text-xs font-normal text-green-700 border-green-300 bg-green-50">
                  {provider.freeCredits} free/mo
                </Badge>
                {provider.authType === 'oauth' && (
                  <Badge variant="outline" className="text-xs font-normal text-purple-700 border-purple-300 bg-purple-50">
                    OAuth
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{provider.description}</CardDescription>
            </div>
          </div>
          {isConnected && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
              onClick={handleRemove}
              disabled={removing}
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Connection status */}
        {isConnected && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-green-700">
              <Check className="h-3.5 w-3.5" />
              <span className="font-medium">Connected</span>
              {(status?.credits_remaining ?? 0) > 0 && (
                <span className="text-gray-500 font-normal">
                  · {status?.credits_remaining} credits remaining
                </span>
              )}
            </div>
            {tokenExpiresInMin !== null && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                Token refreshes in {tokenExpiresInMin}m
              </div>
            )}
            {status?.last_error && (
              <p className="text-xs text-red-600">Error: {status.last_error}</p>
            )}
          </div>
        )}

        {/* Credential input form */}
        {showInput && (
          <div className="space-y-2 pt-2 border-t">
            {provider.authType === 'oauth' ? (
              <>
                <div>
                  <Label htmlFor={`${provider.id}-client-id`} className="text-xs">
                    {provider.credentialLabels.client_id}
                  </Label>
                  <Input
                    id={`${provider.id}-client-id`}
                    type="password"
                    placeholder={`Enter ${provider.credentialLabels.client_id}`}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="mt-1 text-xs h-8"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor={`${provider.id}-client-secret`} className="text-xs">
                    {provider.credentialLabels.client_secret}
                  </Label>
                  <Input
                    id={`${provider.id}-client-secret`}
                    type="password"
                    placeholder={`Enter ${provider.credentialLabels.client_secret}`}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="mt-1 text-xs h-8"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Find these in your{' '}
                  <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Snov.io API settings
                  </a>
                </p>
              </>
            ) : (
              <div>
                <Label htmlFor={`${provider.id}-key`} className="text-xs">
                  {provider.credentialLabels.api_key}
                </Label>
                <Input
                  id={`${provider.id}-key`}
                  type="password"
                  placeholder="Paste your API key here"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1 text-xs h-8"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Connecting...' : 'Save & Connect'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setShowInput(false)
                  setClientId('')
                  setClientSecret('')
                  setApiKey('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!showInput && (
          <div className="flex gap-2">
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => setShowInput(true)}
              >
                Update Credentials
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => setShowInput(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Connect {provider.name}
              </Button>
            )}
            <a
              href={provider.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 h-7 text-xs text-blue-600 hover:underline border border-input rounded-md bg-background hover:bg-accent transition-colors"
            >
              Get Free Key
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
