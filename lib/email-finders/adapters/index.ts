import { SnovAdapter } from './snov-adapter'
import { HunterAdapter } from './hunter-adapter'
import { GetProspectAdapter } from './getprospect-adapter'
import type { EmailFinderAdapter } from './base-adapter'
import type { EmailFinderProvider } from '@/types/email-finders'

const ADAPTER_FACTORIES: Record<EmailFinderProvider, () => EmailFinderAdapter> = {
  snov: () => new SnovAdapter(),
  hunter: () => new HunterAdapter(),
  getprospect: () => new GetProspectAdapter(),
}

export function getAdapter(provider: EmailFinderProvider): EmailFinderAdapter {
  const factory = ADAPTER_FACTORIES[provider]
  if (!factory) throw new Error(`Unknown email finder provider: ${provider}`)
  return factory()
}

export function getAllAdapters(): EmailFinderAdapter[] {
  return Object.values(ADAPTER_FACTORIES).map((f) => f())
}

export function hasAdapter(provider: string): provider is EmailFinderProvider {
  return provider in ADAPTER_FACTORIES
}

export { SnovAdapter, HunterAdapter, GetProspectAdapter }
export type { EmailFinderAdapter } from './base-adapter'
