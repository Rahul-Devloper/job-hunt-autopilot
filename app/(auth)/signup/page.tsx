'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Chrome } from 'lucide-react'
import Link from 'next/link'

function SignupForm() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/jobs'

  async function handleGoogleSignUp() {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Error signing up:', error)
      alert('Failed to sign up. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Your Account</CardTitle>
        <CardDescription>Start automating your job hunt in seconds</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          <Chrome className="mr-2 h-5 w-5" />
          {loading ? 'Creating account...' : 'Sign up with Google'}
        </Button>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link
            href={`/login${redirectTo !== '/jobs' ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
            className="text-blue-600 hover:underline"
          >
            Sign in
          </Link>
        </p>

        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">Free Forever:</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• No credit card required</li>
            <li>• Find HR emails for any company</li>
            <li>• Send via your own Gmail or Yahoo</li>
            <li>• Track opens, clicks, and engagement</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="w-full h-48" />}>
      <SignupForm />
    </Suspense>
  )
}
