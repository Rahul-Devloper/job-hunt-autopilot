'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Check, ExternalLink, Trash2, Plus } from 'lucide-react'
import type { EmailFinderProviderInfo, EmailFinderStatus } from '@/types/email-finders'

interface EmailFinderCardProps {
  provider: EmailFinderProviderInfo
  status: EmailFinderStatus | null
  onSave: (providerId: string, apiKey: string) => Promise<void>
  onRemove: (providerId: string) => Promise<void>
}

export function EmailFinderCard({ provider, status, onSave, onRemove }: EmailFinderCardProps) {
  const [showInput, setShowInput] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await onSave(provider.id, apiKey)
      setApiKey('')
      setShowInput(false)
    } catch {
      alert(`Failed to save ${provider.name} API key`)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${provider.name}?`)) return
    setRemoving(true)
    try {
      await onRemove(provider.id)
    } catch {
      alert(`Failed to remove ${provider.name}`)
    } finally {
      setRemoving(false)
    }
  }

  const isConnected = status?.connected ?? false

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
        {isConnected ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm text-green-700">
              <Check className="h-3.5 w-3.5" />
              <span className="font-medium">Connected</span>
              {(status?.credits_remaining ?? 0) > 0 && (
                <span className="text-gray-500 font-normal">
                  · {status?.credits_remaining} credits remaining
                </span>
              )}
            </div>
            {status?.last_error && (
              <p className="text-xs text-red-600">Last error: {status.last_error}</p>
            )}
          </div>
        ) : null}

        {/* API key input (shown when connecting or updating) */}
        {showInput && (
          <div className="space-y-2">
            <Label htmlFor={`${provider.id}-key`} className="text-xs">
              {provider.apiKeyLabel}
            </Label>
            <Input
              id={`${provider.id}-key`}
              type="password"
              placeholder="Paste your API key here"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="text-xs h-8"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSave} disabled={saving || !apiKey.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => { setShowInput(false); setApiKey('') }}
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
                Update Key
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
              className="inline-flex items-center gap-1 px-2 h-7 text-xs text-blue-600 hover:underline border border-input rounded-md bg-background hover:bg-accent"
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
