import type { EmailFinderProviderInfo } from '@/types/email-finders'

/**
 * All supported email finder providers.
 * Add new providers here — no database changes needed.
 *
 * Snov.io is intentionally omitted — SnovAdapter (lib/email-finders/adapters/
 * snov-adapter.ts) only implements auth, not findByName()/findByLinkedIn(),
 * so it can never return a contact. Re-add here once those are built.
 */
export const EMAIL_FINDER_PROVIDERS: EmailFinderProviderInfo[] = [
  {
    id: 'getprospect',
    name: 'GetProspect',
    freeCredits: 50,
    signupUrl: 'https://getprospect.com/sign-up',
    docsUrl: 'https://app.getprospect.com/api',
    description: 'LinkedIn enrichment — 50 searches/month',
    authType: 'api_key',
    credentialLabels: {
      api_key: 'API Key',
    },
  },
  {
    id: 'hunter',
    name: 'Hunter.io',
    freeCredits: 25,
    signupUrl: 'https://hunter.io/users/sign_up',
    docsUrl: 'https://hunter.io/api-documentation',
    description: 'Reliable domain search — 25 searches/month',
    authType: 'api_key',
    credentialLabels: {
      api_key: 'API Key',
    },
  },
]

/**
 * Total free credits across all providers (50 + 25 = 75)
 */
export const TOTAL_FREE_CREDITS = EMAIL_FINDER_PROVIDERS.reduce(
  (sum, p) => sum + p.freeCredits,
  0
)

export function getProviderInfo(id: string): EmailFinderProviderInfo | undefined {
  return EMAIL_FINDER_PROVIDERS.find((p) => p.id === id)
}
