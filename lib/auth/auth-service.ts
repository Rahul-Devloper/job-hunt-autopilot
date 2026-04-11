import { createClient } from '@/lib/supabase/server'
import { AuthError } from '@/lib/errors/app-error'
import { validateExtensionToken } from '@/lib/extension-auth'

export interface AuthResult {
  userId: string
  email?: string
  metadata?: Record<string, unknown>
}

export type AuthMethod = 'cookie' | 'token' | 'api-key'

export class AuthService {
  /**
   * Authenticate using session cookie (web app / dashboard API routes)
   */
  static async authenticateCookie(): Promise<AuthResult> {
    try {
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        throw new AuthError('No valid session found', 'COOKIE_AUTH_FAILED')
      }

      return { userId: user.id, email: user.email }
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError('Authentication failed', 'COOKIE_AUTH_FAILED')
    }
  }

  /**
   * Authenticate using Bearer token (Chrome extension)
   */
  static async authenticateToken(token: string): Promise<AuthResult> {
    try {
      if (!token) {
        throw new AuthError('No token provided', 'TOKEN_MISSING')
      }

      const validation = await validateExtensionToken(token)

      if (!validation.valid) {
        throw new AuthError(validation.error || 'Invalid token', 'TOKEN_INVALID')
      }

      return {
        userId: validation.userId!,
        metadata: {
          expiresIn: validation.expiresIn,
          expiringSoon: validation.expiringSoon,
        },
      }
    } catch (error) {
      if (error instanceof AuthError) throw error
      throw new AuthError('Token authentication failed', 'TOKEN_AUTH_FAILED')
    }
  }

  /**
   * Extract Bearer token from Authorization header and authenticate
   */
  static async authenticateFromHeader(
    authorization: string | null
  ): Promise<AuthResult> {
    if (!authorization) {
      throw new AuthError('Authorization header missing', 'AUTH_HEADER_MISSING')
    }
    if (!authorization.startsWith('Bearer ')) {
      throw new AuthError('Invalid authorization header format', 'AUTH_HEADER_INVALID')
    }
    return this.authenticateToken(authorization.replace('Bearer ', ''))
  }

  /**
   * Require cookie-based auth (for API routes — throws on failure)
   */
  static async requireAuth(): Promise<AuthResult> {
    return this.authenticateCookie()
  }
}
