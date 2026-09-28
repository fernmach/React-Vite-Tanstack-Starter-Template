import { z } from 'zod'

export type ApiErrorKind = 'network' | 'http' | 'validation' | 'unknown'

type ApiErrorOptions = {
  kind: ApiErrorKind
  message: string
  status?: number
  code?: string
  details?: unknown
  cause?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly details?: unknown
  readonly cause?: unknown

  constructor({
    kind,
    message,
    status,
    code,
    details,
    cause,
  }: ApiErrorOptions) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
    this.details = details
    this.cause = cause
  }
}

const httpErrorPayloadSchema = z.object({
  message: z.string().trim().min(1).max(500),
  code: z.string().trim().min(1).max(100).optional(),
})

const VALIDATION_MESSAGE = 'Received data did not match the expected format.'

type AxiosLikeError = {
  isAxiosError: true
  code?: string
  response?: {
    data?: unknown
    status: number
  }
}

function isAxiosError(error: unknown): error is AxiosLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    error.isAxiosError === true
  )
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof z.ZodError) {
    return new ApiError({
      kind: 'validation',
      message: VALIDATION_MESSAGE,
      details: error.issues,
      cause: error,
    })
  }

  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError({
        kind: 'network',
        message: 'Unable to reach the server. Please try again.',
        code: error.code,
        cause: error,
      })
    }

    const payload = httpErrorPayloadSchema.safeParse(error.response.data)

    if (!payload.success && error.response.data !== undefined) {
      return new ApiError({
        kind: 'validation',
        message: VALIDATION_MESSAGE,
        status: error.response.status,
        details: payload.error.issues,
        cause: error,
      })
    }

    return new ApiError({
      kind: 'http',
      message: payload.success ? payload.data.message : 'The request failed.',
      status: error.response.status,
      code: payload.success ? payload.data.code : error.code,
      cause: error,
    })
  }

  return new ApiError({
    kind: 'unknown',
    message: 'An unexpected error occurred.',
    cause: error,
  })
}
