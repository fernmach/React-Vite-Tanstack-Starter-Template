import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError, normalizeApiError } from './api-error'

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
  })

  it('normalizes network failures', () => {
    const cause = axiosError('ERR_NETWORK')
    expect(normalizeApiError(cause)).toMatchObject({
      kind: 'network',
      code: 'ERR_NETWORK',
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
      message: 'Instruction not found.',
    })
  })

  it('does not trust malformed HTTP error payloads', () => {
    const cause = axiosError('ERR_BAD_RESPONSE', { message: 42 }, 500)
    expect(normalizeApiError(cause)).toMatchObject({
      kind: 'validation',
      status: 500,
    })
  })

  it('normalizes Zod and unknown failures', () => {
    const zodFailure = z.string().safeParse(42)
    if (zodFailure.success) throw new Error('Expected schema failure')

    expect(normalizeApiError(zodFailure.error).kind).toBe('validation')
    expect(normalizeApiError(new Error('private details'))).toMatchObject({
      kind: 'unknown',
      message: 'An unexpected error occurred.',
    })
  })
})
