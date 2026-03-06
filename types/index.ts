export type JobStatus =
  | 'captured'
  | 'email_found'
  | 'email_sent'
  | 'interview'
  | 'offer'
  | 'rejected'

export interface Job {
  id: string
  user_id: string
  company_name: string
  job_title: string
  job_url: string
  job_description: string | null
  status: JobStatus
  hr_email: string | null
  hr_name: string | null
  email_source: 'community' | 'pattern' | 'hunter' | 'manual' | null
  created_at: string
  updated_at: string
}

export interface CommunityEmail {
  id: string
  company_domain: string
  email: string
  email_type: 'generic' | 'personal'
  verified_count: number
  failed_count: number
  contributed_by: string
  created_at: string
}
