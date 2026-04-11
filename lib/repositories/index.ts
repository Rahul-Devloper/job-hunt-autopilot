export { BaseRepository } from './base-repository'
export { JobRepository } from './job-repository'
export { EmailAccountRepository } from './email-account-repository'
export type { EmailAccount } from './email-account-repository'

import { JobRepository } from './job-repository'
import { EmailAccountRepository } from './email-account-repository'

export const jobRepository = new JobRepository()
export const emailAccountRepository = new EmailAccountRepository()
