import { z } from 'zod'

export const createJobSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  job_title: z.string().min(1, 'Job title is required'),
  job_url: z.string().url('Must be a valid URL'),
  job_description: z.string().optional(),
})

export type CreateJobInput = z.infer<typeof createJobSchema>
