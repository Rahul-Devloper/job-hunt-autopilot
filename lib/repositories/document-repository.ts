import { BaseRepository } from './base-repository'
import { RepositoryError } from '@/lib/errors/app-error'

export interface UserDocument {
  id: string
  user_id: string
  document_type: 'cv' | 'cover_letter'
  file_name: string
  file_path: string
  file_size: number
  is_master: boolean
  display_name: string | null
  created_at: string
  updated_at: string
}

export class DocumentRepository extends BaseRepository<UserDocument> {
  constructor() {
    super('user_documents')
  }

  async findMaster(
    userId: string,
    documentType: 'cv' | 'cover_letter'
  ): Promise<UserDocument | null> {
    try {
      const supabase = await this.getClient()

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('document_type', documentType)
        .eq('is_master', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw new RepositoryError(error.message, error)
      }

      return data as UserDocument
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(`Failed to find master ${documentType}`)
    }
  }

  async findByType(
    userId: string,
    documentType: 'cv' | 'cover_letter'
  ): Promise<UserDocument[]> {
    try {
      const supabase = await this.getClient()

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('document_type', documentType)
        .order('is_master', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        throw new RepositoryError(error.message, error)
      }

      return (data || []) as UserDocument[]
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(`Failed to find ${documentType}s`)
    }
  }

  async setMaster(
    documentId: string,
    userId: string,
    documentType: 'cv' | 'cover_letter'
  ): Promise<void> {
    try {
      const supabase = await this.getClient()

      await supabase
        .from(this.tableName)
        .update({ is_master: false })
        .eq('user_id', userId)
        .eq('document_type', documentType)

      const { error } = await supabase
        .from(this.tableName)
        .update({ is_master: true })
        .eq('id', documentId)
        .eq('user_id', userId)

      if (error) {
        throw new RepositoryError(error.message, error)
      }
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('Failed to set master document')
    }
  }
}
