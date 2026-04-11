import { NextRequest } from 'next/server'
import { ApiResponseBuilder } from '@/lib/api/api-response'
import { detectProvider } from '@/lib/smtp-providers'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return ApiResponseBuilder.badRequest('Email parameter is required')
    }

    const provider = detectProvider(email)

    return ApiResponseBuilder.success({ provider })
  } catch (error) {
    return ApiResponseBuilder.fromError(error)
  }
}
