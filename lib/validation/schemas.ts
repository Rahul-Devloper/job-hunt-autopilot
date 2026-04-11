import { z } from 'zod'
import { commonSchemas } from './validation-service'

export const emailAccountSchemas = {
  create: z.object({
    email_address: commonSchemas.email,
    password: commonSchemas.password,
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

export const emailSchemas = {
  send: z.object({
    job_id: commonSchemas.uuid,
    to_emails: z.array(commonSchemas.email).min(1),
    subject: commonSchemas.nonEmptyString,
    body: commonSchemas.nonEmptyString,
    account_id: commonSchemas.uuid.optional(),
  }),
}
