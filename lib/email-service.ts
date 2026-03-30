import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import crypto from 'crypto'

export function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0))
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
}

export function decrypt(encrypted: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0))
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8')
}

export async function sendViaYahoo(
  yahooEmail: string,
  encryptedPassword: string,
  to: string,
  subject: string,
  htmlBody: string
) {
  const password = decrypt(encryptedPassword)

  const transporter = nodemailer.createTransport({
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secure: true,
    auth: {
      user: yahooEmail,
      pass: password,
    },
  })

  return transporter.sendMail({
    from: `Rahul Ramesh <${yahooEmail}>`,
    to,
    subject,
    html: htmlBody,
  })
}

export async function sendViaGmail(
  encryptedRefreshToken: string,
  to: string,
  subject: string,
  htmlBody: string,
  fromName?: string
) {
  const refreshToken = decrypt(encryptedRefreshToken)

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  )

  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const from = fromName ? `Rahul Ramesh <me>` : 'me'
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\n')

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  })
}
