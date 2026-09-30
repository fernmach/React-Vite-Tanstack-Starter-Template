import { isCancelledError } from '@tanstack/react-query'
import { z } from 'zod'

export type ApiErrorKind = 'network' | 'http' | 'validation' | 'unknown'
export type ValidationPhase =
  | 'request'
  | 'response'
  | 'error-payload'
  | 'environment'
export type ApiErrorCodeSource = 'backend' | 'transport'

let nextOccurrenceId = 0

type ApiErrorOptions = {
  kind: ApiErrorKind
  message: string
  status?: number
  code?: string
  codeSource?: ApiErrorCodeSource
  transportCode?: string
  validationPhase?: ValidationPhase
  requestOrigin?: 'input' | 'internal'
  issueCodes?: readonly string[]
  details?: unknown
  cause?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly codeSource?: ApiErrorCodeSource
  readonly transportCode?: string
  readonly validationPhase?: ValidationPhase
  readonly requestOrigin?: 'input' | 'internal'
  readonly issueCodes?: readonly string[]
  readonly occurrenceId: string
  readonly details?: unknown
  readonly cause?: unknown

  constructor({
    kind,
    message,
    status,
    code,
    codeSource,
    transportCode,
    validationPhase,
    requestOrigin,
    issueCodes,
    details,
    cause,
  }: ApiErrorOptions) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
    this.codeSource = codeSource
    this.transportCode = transportCode
    this.validationPhase = validationPhase
    this.requestOrigin = requestOrigin
    this.issueCodes = issueCodes
    this.occurrenceId = `api-error-${++nextOccurrenceId}`
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

type NormalizeApiErrorContext = {
  validationPhase?: ValidationPhase
  requestOrigin?: 'input' | 'internal'
}

export function isApiCancellation(error: unknown): boolean {
  return (
    (typeof error === 'object' &&
      error !== null &&
      '__CANCEL__' in error &&
      error.__CANCEL__ === true) ||
    isCancelledError(error)
  )
}

function issueCodes(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.code)
}

function isAxiosError(error: unknown): error is AxiosLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    error.isAxiosError === true
  )
}

export function normalizeApiError(
  error: unknown,
  context: NormalizeApiErrorContext = {},
): ApiError {
  if (error instanceof ApiError) return error

  // Cancellation is control flow. Callers must check it before normalizing.
  if (isApiCancellation(error)) throw error

  if (error instanceof z.ZodError) {
    return new ApiError({
      kind: 'validation',
      message: VALIDATION_MESSAGE,
      validationPhase: context.validationPhase,
      requestOrigin: context.requestOrigin,
      issueCodes: issueCodes(error),
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
        codeSource: error.code ? 'transport' : undefined,
        transportCode: error.code,
        cause: error,
      })
    }

    const payload = httpErrorPayloadSchema.safeParse(error.response.data)

    if (!payload.success && error.response.data !== undefined) {
      return new ApiError({
        kind: 'validation',
        message: VALIDATION_MESSAGE,
        status: error.response.status,
        transportCode: error.code,
        validationPhase: 'error-payload',
        issueCodes: issueCodes(payload.error),
        details: payload.error.issues,
        cause: error,
      })
    }

    return new ApiError({
      kind: 'http',
      message: payload.success ? payload.data.message : 'The request failed.',
      status: error.response.status,
      code: payload.success ? payload.data.code : undefined,
      codeSource: payload.success && payload.data.code ? 'backend' : undefined,
      transportCode: error.code,
      cause: error,
    })
  }

  return new ApiError({
    kind: 'unknown',
    message: 'An unexpected error occurred.',
    cause: error,
  })
}
