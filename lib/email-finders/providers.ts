import type { EmailFinderProviderInfo } from '@/types/email-finders'

/**
 * All supported email finder providers.
 * Add new providers here — no database changes needed!
 */
export const EMAIL_FINDER_PROVIDERS: EmailFinderProviderInfo[] = [
  {
    id: 'snov',
    name: 'Snov.io',
    freeCredits: 50,
    signupUrl: 'https://snov.io/sign-up',
    docsUrl: 'https://snov.io/api',
    description: 'Best free tier — 50 credits/month',
    apiKeyLabel: 'Snov.io API Key',
  },
  {
    id: 'getprospect',
    name: 'GetProspect',
    freeCredits: 50,
    signupUrl: 'https://getprospect.com/sign-up',
    docsUrl: 'https://app.getprospect.com/api',
    description: 'LinkedIn enrichment — 50 searches/month',
    apiKeyLabel: 'GetProspect API Key',
  },
  {
    id: 'hunter',
    name: 'Hunter.io',
    freeCredits: 25,
    signupUrl: 'https://hunter.io/users/sign_up',
    docsUrl: 'https://hunter.io/api-documentation',
    description: 'Reliable domain search — 25 searches/month',
    apiKeyLabel: 'Hunter.io API Key',
  },
]

/**
 * Total free credits across all providers (50 + 50 + 25 = 125)
 */
export const TOTAL_FREE_CREDITS = EMAIL_FINDER_PROVIDERS.reduce(
  (sum, p) => sum + p.freeCredits,
  0
)

/**
 * Lookup provider info by ID
 */
export function getProviderInfo(id: string): EmailFinderProviderInfo | undefined {
  return EMAIL_FINDER_PROVIDERS.find((p) => p.id === id)
}
