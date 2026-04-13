export { BaseRepository } from './base-repository'
export { JobRepository } from './job-repository'
export { EmailAccountRepository } from './email-account-repository'
export type { EmailAccount } from './email-account-repository'
export { DocumentRepository } from './document-repository'
export type { UserDocument } from './document-repository'

import { JobRepository } from './job-repository'
import { EmailAccountRepository } from './email-account-repository'
import { DocumentRepository } from './document-repository'

export const jobRepository = new JobRepository()
export const emailAccountRepository = new EmailAccountRepository()
export const documentRepository = new DocumentRepository()
