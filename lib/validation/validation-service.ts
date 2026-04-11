import { z } from 'zod'
import { ValidationError } from '@/lib/errors/app-error'

export class ValidationService {
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data)

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      throw new ValidationError('Validation failed', errors)
    }

    return result.data
  }

  static isEmail(value: string): boolean {
    return z.string().email().safeParse(value).success
  }

  static isUUID(value: string): boolean {
    return z.string().uuid().safeParse(value).success
  }

  static isUrl(value: string): boolean {
    return z.string().url().safeParse(value).success
  }

  static isNotEmpty(value: any): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    return true
  }

  static requireNotEmpty(value: any, fieldName: string): void {
    if (!this.isNotEmpty(value)) {
      throw new ValidationError(`${fieldName} is required`)
    }
  }
}

export const commonSchemas = {
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  uuid: z.string().uuid('Invalid ID format'),
  url: z.string().url('Invalid URL format'),
  positiveNumber: z.number().positive('Must be a positive number'),
  nonEmptyString: z.string().min(1, 'Cannot be empty'),
}
