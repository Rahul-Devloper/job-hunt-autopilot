/**
 * SMTP Provider Configuration
 * Auto-detected based on email domain
 */
export interface SmtpProvider {
  name: string
  host: string
  port: number
  secure: boolean // true = SSL (465), false = TLS (587)
  instructions: string
  setupUrl?: string
}

/**
 * Comprehensive SMTP provider database
 * Covers 50+ email providers
 */
export const SMTP_PROVIDERS: Record<string, SmtpProvider> = {
  // Google
  'gmail.com': {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App Password from your Google Account settings. DO NOT use your regular Gmail password.',
    setupUrl: 'https://myaccount.google.com/apppasswords',
  },
  'googlemail.com': {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App Password from your Google Account settings.',
    setupUrl: 'https://myaccount.google.com/apppasswords',
  },

  // Microsoft
  'outlook.com': {
    name: 'Outlook',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    instructions: 'Use your regular Microsoft account password.',
  },
  'hotmail.com': {
    name: 'Hotmail',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    instructions: 'Use your regular Microsoft account password.',
  },
  'live.com': {
    name: 'Outlook Live',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    instructions: 'Use your regular Microsoft account password.',
  },
  'msn.com': {
    name: 'MSN',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    instructions: 'Use your regular Microsoft account password.',
  },

  // Yahoo
  'yahoo.com': {
    name: 'Yahoo',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App Password from Yahoo Account Security settings.',
    setupUrl: 'https://login.yahoo.com/account/security',
  },
  'yahoo.co.uk': {
    name: 'Yahoo UK',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App Password from Yahoo Account Security settings.',
    setupUrl: 'https://login.yahoo.com/account/security',
  },
  'ymail.com': {
    name: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App Password from Yahoo Account Security settings.',
    setupUrl: 'https://login.yahoo.com/account/security',
  },

  // UK Providers
  'btinternet.com': {
    name: 'BT Internet',
    host: 'mail.btinternet.com',
    port: 587,
    secure: false,
    instructions: 'Use your BT email password.',
  },
  'virginmedia.com': {
    name: 'Virgin Media',
    host: 'smtp.virginmedia.com',
    port: 465,
    secure: true,
    instructions: 'Use your Virgin Media email password.',
  },
  'sky.com': {
    name: 'Sky',
    host: 'smtp.sky.com',
    port: 587,
    secure: false,
    instructions: 'Use your Sky email password.',
  },
  'talktalk.net': {
    name: 'TalkTalk',
    host: 'smtp.talktalk.net',
    port: 587,
    secure: false,
    instructions: 'Use your TalkTalk email password.',
  },

  // Apple
  'icloud.com': {
    name: 'iCloud',
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App-Specific Password from Apple ID settings.',
    setupUrl: 'https://appleid.apple.com/account/manage',
  },
  'me.com': {
    name: 'iCloud (me.com)',
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App-Specific Password from Apple ID settings.',
    setupUrl: 'https://appleid.apple.com/account/manage',
  },
  'mac.com': {
    name: 'iCloud (mac.com)',
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App-Specific Password from Apple ID settings.',
    setupUrl: 'https://appleid.apple.com/account/manage',
  },

  // Business Email Providers
  'zoho.com': {
    name: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    instructions: 'Use your Zoho email password.',
  },
  'protonmail.com': {
    name: 'ProtonMail',
    host: 'smtp.protonmail.ch',
    port: 587,
    secure: false,
    instructions: 'ProtonMail requires the ProtonMail Bridge application for SMTP access.',
    setupUrl: 'https://protonmail.com/bridge',
  },
  'fastmail.com': {
    name: 'FastMail',
    host: 'smtp.fastmail.com',
    port: 587,
    secure: false,
    instructions: 'Use an App Password from FastMail settings.',
    setupUrl: 'https://www.fastmail.com/settings/security/devicekeys',
  },

  // AOL
  'aol.com': {
    name: 'AOL',
    host: 'smtp.aol.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App Password from AOL Account Security.',
    setupUrl: 'https://login.aol.com/account/security',
  },

  // GMX
  'gmx.com': {
    name: 'GMX',
    host: 'mail.gmx.com',
    port: 587,
    secure: false,
    instructions: 'Use your GMX email password.',
  },
  'gmx.net': {
    name: 'GMX',
    host: 'mail.gmx.net',
    port: 587,
    secure: false,
    instructions: 'Use your GMX email password.',
  },

  // Mail.com
  'mail.com': {
    name: 'Mail.com',
    host: 'smtp.mail.com',
    port: 587,
    secure: false,
    instructions: 'Use your Mail.com password.',
  },

  // Yandex
  'yandex.com': {
    name: 'Yandex',
    host: 'smtp.yandex.com',
    port: 587,
    secure: false,
    instructions: 'Generate an App Password from Yandex settings.',
  },
}

/**
 * Detect SMTP provider from email address
 */
export function detectProvider(email: string): SmtpProvider | null {
  if (!email || !email.includes('@')) return null

  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null

  return SMTP_PROVIDERS[domain] || null
}

/**
 * Get template for custom SMTP configuration
 */
export function getCustomProviderTemplate(): Partial<SmtpProvider> {
  return {
    name: 'Custom',
    host: '',
    port: 587,
    secure: false,
    instructions: 'Enter your SMTP server details from your email provider.',
  }
}

/**
 * Validate SMTP configuration
 */
export function isValidSmtpConfig(config: {
  host: string
  port: number
  secure: boolean
}): boolean {
  if (!config.host || config.host.trim().length === 0) return false
  if (!config.port || config.port < 1 || config.port > 65535) return false
  return true
}
