export interface ApiSuccess<T = any> {
  success: true
  data: T
  message?: string
  meta?: {
    page?: number
    limit?: number
    total?: number
    [key: string]: any
  }
}

export interface ApiError {
  success: false
  error: {
    message: string
    code: string
    details?: any
  }
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError

export class ApiResponseBuilder {
  static success<T>(
    data: T,
    message?: string,
    meta?: ApiSuccess['meta']
  ): Response {
    const response: ApiSuccess<T> = { success: true, data }
    if (message) response.message = message
    if (meta) response.meta = meta
    return Response.json(response, { status: 200 })
  }

  static created<T>(
    data: T,
    message: string = 'Resource created successfully'
  ): Response {
    return Response.json(
      { success: true, data, message } as ApiSuccess<T>,
      { status: 201 }
    )
  }

  static noContent(): Response {
    return new Response(null, { status: 204 })
  }

  static error(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    status: number = 500,
    details?: any
  ): Response {
    return Response.json(
      {
        success: false,
        error: { message, code, details },
      } as ApiError,
      { status }
    )
  }

  static badRequest(message: string, details?: any): Response {
    return this.error(message, 'BAD_REQUEST', 400, details)
  }

  static unauthorized(message: string = 'Unauthorized'): Response {
    return this.error(message, 'UNAUTHORIZED', 401)
  }

  static forbidden(message: string = 'Forbidden'): Response {
    return this.error(message, 'FORBIDDEN', 403)
  }

  static notFound(message: string = 'Resource not found'): Response {
    return this.error(message, 'NOT_FOUND', 404)
  }

  static serverError(message: string = 'Internal server error'): Response {
    return this.error(message, 'INTERNAL_ERROR', 500)
  }

  static fromError(error: any): Response {
    console.error('API Error:', error)

    if (error.name && error.code && error.statusCode) {
      return this.error(error.message, error.code, error.statusCode, error.details)
    }

    if (error instanceof Error) {
      return this.serverError(error.message)
    }

    return this.serverError('An unknown error occurred')
  }
}
