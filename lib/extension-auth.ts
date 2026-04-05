import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

/**
 * Generate a secure extension token
 * Format: jha_ext_[short_user_id]_[random_32_chars]_[timestamp]
 */
export function generateExtensionToken(userId: string): string {
  const shortUserId = userId.split('-')[0]
  const randomPart = crypto.randomBytes(16).toString('hex')
  const timestamp = Date.now().toString(36)

  return `jha_ext_${shortUserId}_${randomPart}_${timestamp}`
}

/**
 * Validate extension token and return detailed info
 */
export async function validateExtensionToken(token: string): Promise<{
  valid: boolean
  userId?: string
  error?: string
  expiresIn?: number
  expiringSoon?: boolean
}> {
  try {
    if (!token || !token.startsWith('jha_ext_')) {
      return { valid: false, error: 'Invalid token format' }
    }

    const supabase = await createClient()

    const { data: tokenData, error: tokenError } = await supabase
      .from('extension_tokens')
      .select('user_id, expires_at, revoked')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return { valid: false, error: 'Token not found' }
    }

    if (tokenData.revoked) {
      return { valid: false, error: 'Token has been revoked' }
    }

    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)

    if (expiresAt < now) {
      return { valid: false, error: 'Token has expired' }
    }

    const msUntilExpiration = expiresAt.getTime() - now.getTime()
    const daysUntilExpiration = Math.ceil(msUntilExpiration / (1000 * 60 * 60 * 24))
    const expiringSoon = daysUntilExpiration <= 2
    // const expiringSoon = daysUntilExpiration <= 7

    // Update last_used_at async, don't await
    supabase
      .from('extension_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token)
      .then()

    return {
      valid: true,
      userId: tokenData.user_id,
      expiresIn: daysUntilExpiration,
      expiringSoon,
    }
  } catch (error) {
    console.error('Token validation error:', error)
    return { valid: false, error: 'Internal validation error' }
  }
}

/**
 * Revoke an extension token by its row id
 */
export async function revokeExtensionToken(tokenId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('extension_tokens')
      .update({ revoked: true })
      .eq('id', tokenId)
    return !error
  } catch (error) {
    console.error('Token revocation error:', error)
    return false
  }
}
