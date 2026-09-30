import { describe, expect, it } from 'vitest'
import { CancelledError } from '@tanstack/react-query'
import { z } from 'zod'
import { ApiError, isApiCancellation, normalizeApiError } from './api-error'

function axiosError(code: string, data?: unknown, status?: number) {
  return {
    isAxiosError: true as const,
    code,
    response: status === undefined ? undefined : { data, status },
  }
}

describe('normalizeApiError', () => {
  it('preserves ApiError instances', () => {
    const error = new ApiError({ kind: 'unknown', message: 'Safe message' })
    expect(normalizeApiError(error)).toBe(error)
    expect(normalizeApiError(error).occurrenceId).toBe(error.occurrenceId)
  })

  it('normalizes network failures', () => {
    const cause = axiosError('ERR_NETWORK')
    expect(normalizeApiError(cause)).toMatchObject({
      kind: 'network',
      code: 'ERR_NETWORK',
      codeSource: 'transport',
      transportCode: 'ERR_NETWORK',
      message: 'Unable to reach the server. Please try again.',
    })
  })

  it('normalizes validated HTTP error payloads', () => {
    const cause = axiosError(
      'ERR_BAD_REQUEST',
      { message: 'Instruction not found.', code: 'NOT_FOUND' },
      404,
    )

    expect(normalizeApiError(cause)).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'NOT_FOUND',
      codeSource: 'backend',
      transportCode: 'ERR_BAD_REQUEST',
      message: 'Instruction not found.',
    })
  })

  it('does not trust malformed HTTP error payloads', () => {
    const cause = axiosError('ERR_BAD_RESPONSE', { message: 42 }, 500)
    expect(normalizeApiError(cause)).toMatchObject({
      kind: 'validation',
      status: 500,
      validationPhase: 'error-payload',
      code: undefined,
      transportCode: 'ERR_BAD_RESPONSE',
    })
  })

  it('keeps absent HTTP bodies as HTTP errors without treating transport codes as backend codes', () => {
    expect(
      normalizeApiError(axiosError('ERR_BAD_REQUEST', undefined, 403)),
    ).toMatchObject({
      kind: 'http',
      status: 403,
      code: undefined,
      codeSource: undefined,
      transportCode: 'ERR_BAD_REQUEST',
    })
  })

  it('normalizes Zod and unknown failures', () => {
    const zodFailure = z.string().safeParse(42)
    if (zodFailure.success) throw new Error('Expected schema failure')

    expect(
      normalizeApiError(zodFailure.error, { validationPhase: 'request' }),
    ).toMatchObject({
      kind: 'validation',
      validationPhase: 'request',
      issueCodes: ['invalid_type'],
    })
    expect(normalizeApiError(new Error('private details'))).toMatchObject({
      kind: 'unknown',
      message: 'An unexpected error occurred.',
    })
  })

  it('gives independent failures different occurrence identities', () => {
    const first = normalizeApiError(new Error('private'))
    const second = normalizeApiError(new Error('private'))
    expect(first.occurrenceId).not.toBe(second.occurrenceId)
  })

  it('recognizes Axios and Query cancellation without replacing either error', () => {
    const axiosCancellation = {
      __CANCEL__: true,
      message: 'private cancellation detail',
    }
    const queryCancellation = new CancelledError()
    expect(isApiCancellation(axiosCancellation)).toBe(true)
    expect(isApiCancellation(queryCancellation)).toBe(true)
    expect(isApiCancellation(new Error('ERR_CANCELED'))).toBe(false)
    expect(() => normalizeApiError(axiosCancellation)).toThrow(
      axiosCancellation,
    )
    expect(() => normalizeApiError(queryCancellation)).toThrow(
      queryCancellation,
    )
  })
})
