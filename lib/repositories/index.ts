export { BaseRepository } from './base-repository'
export { EmailFinderRepository } from './email-finder-repository'
export { JobRepository } from './job-repository'
export { EmailAccountRepository } from './email-account-repository'
export type { EmailAccount } from './email-account-repository'
export { DocumentRepository } from './document-repository'
export type { UserDocument } from './document-repository'
export { JobContactRepository } from './job-contact-repository'
export type { JobContact } from './job-contact-repository'

import { JobRepository } from './job-repository'
import { EmailAccountRepository } from './email-account-repository'
import { DocumentRepository } from './document-repository'
import { JobContactRepository } from './job-contact-repository'

export const jobRepository = new JobRepository()
export const emailAccountRepository = new EmailAccountRepository()
export const documentRepository = new DocumentRepository()
export const jobContactRepository = new JobContactRepository()
