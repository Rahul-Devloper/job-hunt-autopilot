import { z } from 'zod'
import { commonSchemas } from './validation-service'

export const emailAccountSchemas = {
  create: z.object({
    email_address: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
    smtp_host: z.string().optional(),
    smtp_port: z.number().int().min(1).max(65535).optional(),
    smtp_secure: z.boolean().optional(),
  }),

  test: z.object({
    account_id: commonSchemas.uuid,
  }),

  setPrimary: z.object({
    account_id: commonSchemas.uuid,
  }),
}

export const jobSchemas = {
  create: z.object({
    company_name: commonSchemas.nonEmptyString,
    job_title: commonSchemas.nonEmptyString,
    job_url: commonSchemas.url,
    location: z.string().optional(),
  }),

  update: z.object({
    company_name: z.string().optional(),
    job_title: z.string().optional(),
    location: z.string().optional(),
    // Uses actual DB enum values
    status: z
      .enum(['captured', 'email_found', 'email_sent', 'interview', 'offer', 'rejected'])
      .optional(),
  }),
}

export const extensionTokenSchemas = {
  generate: z.object({
    device_name: z.string().optional(),
  }),

  validate: z.object({
    token: z.string().startsWith('jha_ext_'),
  }),
}

/**
 * Parses a comma-separated email string into a validated string[].
 * Accepts both "a@x.com" and "a@x.com, b@x.com, c@x.com".
 */
const emailOrEmailList = z
  .string()
  .min(1, 'At least one recipient email is required')
  .transform((str) =>
    str
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
  )
  .refine((emails) => emails.length > 0, {
    message: 'At least one valid email is required',
  })
  .refine(
    (emails) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emails.every((e) => re.test(e))
    },
    { message: 'All emails must be valid email addresses' }
  )

export const sendEmailSchema = z.object({
  job_id: commonSchemas.uuid,
  to: emailOrEmailList,
  subject: commonSchemas.nonEmptyString,
  body: commonSchemas.nonEmptyString,
  account_id: commonSchemas.uuid.optional(),
  contact_id: commonSchemas.uuid.optional(),
})

export const emailSchemas = {
  send: z.object({
    job_id: commonSchemas.uuid,
    to_emails: z.array(commonSchemas.email).min(1),
    subject: commonSchemas.nonEmptyString,
    body: commonSchemas.nonEmptyString,
    account_id: commonSchemas.uuid.optional(),
  }),
}

export const documentSchemas = {
  upload: z.object({
    document_type: z.enum(['cv', 'cover_letter']),
    display_name: z.string().optional(),
  }),

  setMaster: z.object({
    document_id: commonSchemas.uuid,
    document_type: z.enum(['cv', 'cover_letter']),
  }),
}

export const jobContactSchemas = {
  create: z.object({
    job_id: commonSchemas.uuid,
    email: commonSchemas.email,
    contact_name: z.string().optional(),
    contact_role: z.string().optional(),
    contact_source: z
      .enum(['linkedin', 'manual', 'company_website', 'referral', 'auto', 'poster'])
      .optional(),
    notes: z.string().optional(),
    is_primary: z.boolean().optional(),
  }),

  update: z.object({
    email: commonSchemas.email.optional(),
    contact_name: z.string().optional(),
    contact_role: z.string().optional(),
    notes: z.string().optional(),
  }),

  setPrimary: z.object({
    contact_id: commonSchemas.uuid,
    job_id: commonSchemas.uuid,
  }),
}
