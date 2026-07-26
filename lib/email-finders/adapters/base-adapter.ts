import type { AuthResult } from '@/types/email-finders'

export interface EmailFinderAdapter {
  readonly id: string
  readonly name: string
  requiresRefresh(): boolean
  authenticate(credentials: Record<string, string>): Promise<AuthResult>
  refreshAuth?(config: Record<string, string>): Promise<AuthResult>
}

export abstract class BaseEmailFinderAdapter implements EmailFinderAdapter {
  abstract readonly id: string
  abstract readonly name: string
  abstract authenticate(credentials: Record<string, string>): Promise<AuthResult>

  requiresRefresh(): boolean {
    return false
  }
}
