import type { Contact } from '@/lib/services/contact-discovery-service'
import type { AuthResult } from '@/types/email-finders'

export interface EmailFinderAdapter {
  readonly id: string
  readonly name: string
  requiresRefresh(): boolean
  authenticate(credentials: Record<string, string>): Promise<AuthResult>
  refreshAuth?(config: Record<string, string>): Promise<AuthResult>
  searchByDomain(domain: string, token: string): Promise<Contact[]>
  getCreditsUsed(contacts: Contact[]): number
}

export abstract class BaseEmailFinderAdapter implements EmailFinderAdapter {
  abstract readonly id: string
  abstract readonly name: string
  abstract authenticate(credentials: Record<string, string>): Promise<AuthResult>
  abstract searchByDomain(domain: string, token: string): Promise<Contact[]>

  requiresRefresh(): boolean {
    return false
  }

  getCreditsUsed(contacts: Contact[]): number {
    return contacts.length
  }

  protected isRelevantRole(title: string): boolean {
    const t = title.toLowerCase()
    return (
      t.includes('recruit') ||
      t.includes('talent') ||
      t.includes('hiring') ||
      t.includes('hr') ||
      t.includes('people') ||
      t.includes('manager') ||
      t.includes('director') ||
      t.includes('head') ||
      t.includes('vp') ||
      t.includes('vice president') ||
      t.includes('chief') ||
      t.includes('cto') ||
      t.includes('ceo') ||
      t.includes('founder')
    )
  }
}
