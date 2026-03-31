import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Mail, TrendingUp, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="container mx-auto flex items-center justify-between p-6">
        <h1 className="text-2xl font-bold text-blue-600">Job Hunt Autopilot</h1>
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-20 text-center">
        <h2 className="mb-6 text-5xl font-bold text-gray-900">
          Automate Your Job Hunt
        </h2>
        <p className="mb-8 text-xl text-gray-600 max-w-2xl mx-auto">
          Capture jobs from LinkedIn, find HR emails for free, send tracked emails, and see who&apos;s interested — all in one place.
        </p>

        <Link href="/signup">
          <Button size="lg" className="text-lg px-8">
            Start Free Today
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>

        <p className="mt-4 text-sm text-gray-500">No credit card required</p>

        <div className="mt-20 grid gap-8 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <Zap className="mx-auto mb-4 h-12 w-12 text-blue-600" />
            <h3 className="mb-2 text-xl font-bold">Find Emails Free</h3>
            <p className="text-gray-600">
              No more paying $49/month for email finders. Our community database grows with every user.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <Mail className="mx-auto mb-4 h-12 w-12 text-blue-600" />
            <h3 className="mb-2 text-xl font-bold">Track Everything</h3>
            <p className="text-gray-600">
              Know when recruiters open your emails and click your LinkedIn profile.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <TrendingUp className="mx-auto mb-4 h-12 w-12 text-blue-600" />
            <h3 className="mb-2 text-xl font-bold">Analytics Dashboard</h3>
            <p className="text-gray-600">
              See which companies are interested with beautiful charts and hot lead alerts.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
