'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Chrome } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Error signing in:', error)
      alert('Failed to sign in. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome Back</CardTitle>
        <CardDescription>Sign in to your Job Hunt Autopilot account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          <Chrome className="mr-2 h-5 w-5" />
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </Button>

        <p className="text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign up free
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
