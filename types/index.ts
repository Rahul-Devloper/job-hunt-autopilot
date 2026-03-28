import { Database } from './database'

// Export database types
export type { Database }

// Helper types for tables
export type Job = Database['public']['Tables']['jobs']['Row']
export type JobInsert = Database['public']['Tables']['jobs']['Insert']
export type JobUpdate = Database['public']['Tables']['jobs']['Update']

export type CommunityEmail = Database['public']['Tables']['community_emails']['Row']
export type CommunityEmailInsert = Database['public']['Tables']['community_emails']['Insert']
export type CommunityEmailUpdate = Database['public']['Tables']['community_emails']['Update']

export type EmailSent = Database['public']['Tables']['emails_sent']['Row']
export type EmailSentInsert = Database['public']['Tables']['emails_sent']['Insert']

export type EmailVerification = Database['public']['Tables']['email_verifications']['Row']
export type EmailVerificationInsert = Database['public']['Tables']['email_verifications']['Insert']

export type FollowupReminder = Database['public']['Tables']['followup_reminders']['Row']
export type FollowupReminderInsert = Database['public']['Tables']['followup_reminders']['Insert']

export type LinkClick = Database['public']['Tables']['link_clicks']['Row']
export type LinkClickInsert = Database['public']['Tables']['link_clicks']['Insert']

export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert']
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update']

export type UserStats = Database['public']['Tables']['user_stats']['Row']
export type UserStatsInsert = Database['public']['Tables']['user_stats']['Insert']
export type UserStatsUpdate = Database['public']['Tables']['user_stats']['Update']

// Export enums
export type JobStatus = Database['public']['Enums']['job_status']
export type EmailSource = Database['public']['Enums']['email_source']
export type EmailType = Database['public']['Enums']['email_type']
