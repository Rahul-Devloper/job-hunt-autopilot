import { BaseRepository } from './base-repository'
import { RepositoryError } from '@/lib/errors/app-error'

export interface JobContact {
  id: string
  job_id: string
  user_id: string
  email: string
  contact_name: string | null
  contact_role: string | null
  contact_source: 'linkedin' | 'manual' | 'company_website' | 'referral' | 'auto' | 'poster' | null
  notes: string | null
  is_primary: boolean
  is_poster: boolean
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  last_contacted_at: string | null
  first_response_at: string | null
  created_at: string
  updated_at: string
}

export class JobContactRepository extends BaseRepository<JobContact> {
  constructor() {
    super('job_contacts')
  }

  /**
   * Find all contacts for a job, primary first
   */
  async findByJob(jobId: string, userId: string): Promise<JobContact[]> {
    try {
      const supabase = await this.getClient()

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('job_id', jobId)
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw new RepositoryError(error.message, error)
      return (data || []) as JobContact[]
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('Failed to find job contacts')
    }
  }

  /**
   * Find primary contact for a job
   */
  async findPrimary(jobId: string, userId: string): Promise<JobContact | null> {
    try {
      const supabase = await this.getClient()

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('job_id', jobId)
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw new RepositoryError(error.message, error)
      }
      return data as JobContact
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('Failed to find primary contact')
    }
  }

  /**
   * Set contact as primary — unsets all others for this job first
   */
  async setPrimary(contactId: string, jobId: string, userId: string): Promise<void> {
    try {
      const supabase = await this.getClient()

      // Unset existing primary for this job
      await supabase
        .from(this.tableName)
        .update({ is_primary: false })
        .eq('job_id', jobId)
        .eq('user_id', userId)

      // Set new primary
      const { error } = await supabase
        .from(this.tableName)
        .update({ is_primary: true })
        .eq('id', contactId)
        .eq('user_id', userId)

      if (error) throw new RepositoryError(error.message, error)
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('Failed to set primary contact')
    }
  }

  /**
   * Increment emails_sent counter and update last_contacted_at
   */
  async incrementSent(contactId: string): Promise<void> {
    try {
      const supabase = await this.getClient()
      const contact = await this.findById(contactId)
      if (!contact) return

      await supabase
        .from(this.tableName)
        .update({
          emails_sent: contact.emails_sent + 1,
          last_contacted_at: new Date().toISOString(),
        })
        .eq('id', contactId)
    } catch {
      console.error('Failed to increment sent count')
    }
  }

  /**
   * Increment emails_opened counter
   */
  async incrementOpened(contactId: string): Promise<void> {
    try {
      const supabase = await this.getClient()
      const contact = await this.findById(contactId)
      if (!contact) return

      await supabase
        .from(this.tableName)
        .update({ emails_opened: contact.emails_opened + 1 })
        .eq('id', contactId)
    } catch {
      console.error('Failed to increment opened count')
    }
  }

  /**
   * Record a reply from a contact (increments counter, sets first_response_at on first reply)
   */
  async recordReply(contactId: string): Promise<void> {
    try {
      const supabase = await this.getClient()
      const contact = await this.findById(contactId)
      if (!contact) return

      const updates: Partial<JobContact> = {
        emails_replied: contact.emails_replied + 1,
      }

      if (!contact.first_response_at) {
        updates.first_response_at = new Date().toISOString()
      }

      await supabase
        .from(this.tableName)
        .update(updates)
        .eq('id', contactId)
    } catch {
      console.error('Failed to record reply')
    }
  }

  /**
   * Aggregate contact stats for analytics
   */
  async getContactStats(userId: string): Promise<{
    total_contacts: number
    avg_response_rate: number
    best_performing_role: string | null
  }> {
    try {
      const supabase = await this.getClient()

      const { data, error } = await supabase
        .from(this.tableName)
        .select('contact_role, emails_sent, emails_replied')
        .eq('user_id', userId)

      if (error) throw new RepositoryError(error.message, error)

      const contacts = (data || []) as Pick<JobContact, 'contact_role' | 'emails_sent' | 'emails_replied'>[]
      const total_contacts = contacts.length
      const total_sent = contacts.reduce((s, c) => s + c.emails_sent, 0)
      const total_replied = contacts.reduce((s, c) => s + c.emails_replied, 0)
      const avg_response_rate = total_sent > 0 ? (total_replied / total_sent) * 100 : 0

      const roleStats = contacts.reduce(
        (acc, c) => {
          const role = c.contact_role || 'Unknown'
          if (!acc[role]) acc[role] = { sent: 0, replied: 0 }
          acc[role].sent += c.emails_sent
          acc[role].replied += c.emails_replied
          return acc
        },
        {} as Record<string, { sent: number; replied: number }>
      )

      let best_performing_role: string | null = null
      let best_rate = 0
      for (const [role, stats] of Object.entries(roleStats)) {
        if (stats.sent > 0) {
          const rate = (stats.replied / stats.sent) * 100
          if (rate > best_rate) {
            best_rate = rate
            best_performing_role = role
          }
        }
      }

      return {
        total_contacts,
        avg_response_rate: parseFloat(avg_response_rate.toFixed(1)),
        best_performing_role,
      }
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('Failed to get contact stats')
    }
  }
}
