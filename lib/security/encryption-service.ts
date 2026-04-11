import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-cbc'
  private static readonly KEY = process.env.ENCRYPTION_KEY!

  static {
    if (!this.KEY) {
      throw new Error('ENCRYPTION_KEY environment variable is not set')
    }
    if (this.KEY.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    }
  }

  /**
   * Encrypt a string. Returns iv:encryptedData (hex format).
   */
  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv(
        this.ALGORITHM,
        Buffer.from(this.KEY, 'hex'),
        iv
      )
      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      return `${iv.toString('hex')}:${encrypted}`
    } catch (error) {
      console.error('Encryption error:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt a string. Expects iv:encryptedData (hex format).
   */
  static decrypt(encrypted: string): string {
    try {
      const parts = encrypted.split(':')
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format')
      }
      const iv = Buffer.from(parts[0], 'hex')
      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        Buffer.from(this.KEY, 'hex'),
        iv
      )
      let decrypted = decipher.update(parts[1], 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (error) {
      console.error('Decryption error:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  static encryptObject<T>(obj: T): string {
    return this.encrypt(JSON.stringify(obj))
  }

  static decryptObject<T>(encrypted: string): T {
    return JSON.parse(this.decrypt(encrypted)) as T
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10)
    return bcrypt.hash(password, salt)
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  static generateUUID(): string {
    return crypto.randomUUID()
  }
}
