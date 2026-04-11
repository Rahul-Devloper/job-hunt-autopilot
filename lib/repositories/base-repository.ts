import { createClient } from '@/lib/supabase/server'
import { RepositoryError, NotFoundError } from '@/lib/errors/app-error'
import type { SupabaseClient } from '@supabase/supabase-js'

export abstract class BaseRepository<T> {
  constructor(protected readonly tableName: string) {}

  protected async getClient(): Promise<SupabaseClient> {
    return createClient()
  }

  async findById(id: string, userId?: string): Promise<T | null> {
    try {
      const supabase = await this.getClient()
      let query = supabase.from(this.tableName).select('*').eq('id', id)
      if (userId) query = query.eq('user_id', userId)

      const { data, error } = await query.single()
      if (error) {
        if (error.code === 'PGRST116') return null
        throw new RepositoryError(error.message, error)
      }
      return data as T
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(`Failed to find ${this.tableName} by ID`)
    }
  }

  async findAll(userId: string): Promise<T[]> {
    try {
      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw new RepositoryError(error.message, error)
      return (data || []) as T[]
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(`Failed to find all ${this.tableName}`)
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const supabase = await this.getClient()
      const { data: created, error } = await supabase
        .from(this.tableName)
        .insert(data)
        .select()
        .single()

      if (error) throw new RepositoryError(error.message, error)
      return created as T
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(`Failed to create ${this.tableName}`)
    }
  }

  async update(id: string, data: Partial<T>, userId?: string): Promise<T> {
    try {
      const supabase = await this.getClient()
      let query = supabase.from(this.tableName).update(data).eq('id', id)
      if (userId) query = query.eq('user_id', userId)

      const { data: updated, error } = await query.select().single()
      if (error) {
        if (error.code === 'PGRST116') throw new NotFoundError(this.tableName)
        throw new RepositoryError(error.message, error)
      }
      return updated as T
    } catch (error) {
      if (error instanceof RepositoryError || error instanceof NotFoundError) throw error
      throw new RepositoryError(`Failed to update ${this.tableName}`)
    }
  }

  async delete(id: string, userId?: string): Promise<void> {
    try {
      const supabase = await this.getClient()
      let query = supabase.from(this.tableName).delete().eq('id', id)
      if (userId) query = query.eq('user_id', userId)

      const { error } = await query
      if (error) throw new RepositoryError(error.message, error)
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(`Failed to delete ${this.tableName}`)
    }
  }

  async count(userId: string): Promise<number> {
    try {
      const supabase = await this.getClient()
      const { count, error } = await supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) throw new RepositoryError(error.message, error)
      return count || 0
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(`Failed to count ${this.tableName}`)
    }
  }
}
