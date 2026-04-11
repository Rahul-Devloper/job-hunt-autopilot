import { BaseRepository } from './base-repository'
import type { Job } from '@/types'

export class JobRepository extends BaseRepository<Job> {
  constructor() {
    super('jobs')
  }

  async findByStatus(userId: string, status: string): Promise<Job[]> {
    const supabase = await this.getClient()
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as Job[]
  }

  async findByCompany(userId: string, companyName: string): Promise<Job[]> {
    const supabase = await this.getClient()
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .ilike('company_name', `%${companyName}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as Job[]
  }
}
