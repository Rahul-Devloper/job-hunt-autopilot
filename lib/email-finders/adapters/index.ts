import { SnovAdapter } from './snov-adapter'
import { HunterAdapter } from './hunter-adapter'
import { GetProspectAdapter } from './getprospect-adapter'
import type { EmailFinderAdapter } from './base-adapter'
import type { EmailFinderProvider } from '@/types/email-finders'

const ADAPTERS: Record<EmailFinderProvider, EmailFinderAdapter> = {
  snov: new SnovAdapter(),
  hunter: new HunterAdapter(),
  getprospect: new GetProspectAdapter(),
}

export function getAdapter(provider: EmailFinderProvider): EmailFinderAdapter {
  const adapter = ADAPTERS[provider]
  if (!adapter) throw new Error(`Unknown email finder provider: ${provider}`)
  return adapter
}

export function getAllAdapters(): EmailFinderAdapter[] {
  return Object.values(ADAPTERS)
}

export function hasAdapter(provider: string): provider is EmailFinderProvider {
  return provider in ADAPTERS
}

export { SnovAdapter, HunterAdapter, GetProspectAdapter }
export type { EmailFinderAdapter } from './base-adapter'
