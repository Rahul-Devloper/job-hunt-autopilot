import { BaseRepository } from './base-repository'
import { RepositoryError } from '@/lib/errors/app-error'

export interface EmailAccount {
  id: string
  user_id: string
  email_address: string
  provider_name: string | null
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  smtp_password_encrypted: string
  is_verified: boolean
  is_primary: boolean
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export class EmailAccountRepository extends BaseRepository<EmailAccount> {
  constructor() {
    super('user_email_accounts')
  }

  async findPrimary(userId: string): Promise<EmailAccount | null> {
    const supabase = await this.getClient()
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as EmailAccount
  }

  async setPrimary(accountId: string, userId: string): Promise<void> {
    const supabase = await this.getClient()
    await supabase
      .from(this.tableName)
      .update({ is_primary: false })
      .eq('user_id', userId)

    await supabase
      .from(this.tableName)
      .update({ is_primary: true })
      .eq('id', accountId)
      .eq('user_id', userId)
  }

  async updateLastUsed(accountId: string): Promise<void> {
    const supabase = await this.getClient()
    await supabase
      .from(this.tableName)
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', accountId)
  }

  async findByEmail(userId: string, email: string): Promise<EmailAccount | null> {
    try {
      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('email_address', email)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw new RepositoryError(error.message, error)
      }
      return data as EmailAccount
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('Failed to find email account')
    }
  }
}
