import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { parseEnvironment } from './env'

describe('parseEnvironment', () => {
  it('uses deterministic development defaults', () => {
    expect(parseEnvironment({ DEV: true, PROD: false })).toEqual({
      API_URL: '/api',
      ENABLE_API_MOCKING: true,
      IS_DEVELOPMENT: true,
    })
  })

  it('disables API mocking by default in production', () => {
    expect(parseEnvironment({ DEV: false, PROD: true })).toEqual({
      API_URL: '/api',
      ENABLE_API_MOCKING: false,
      IS_DEVELOPMENT: false,
    })
  })

  it('cannot enable API mocking explicitly in production', () => {
    expect(
      parseEnvironment({
        VITE_ENABLE_API_MOCKING: 'true',
        DEV: false,
        PROD: true,
      }),
    ).toEqual({
      API_URL: '/api',
      ENABLE_API_MOCKING: false,
      IS_DEVELOPMENT: false,
    })
  })

  it('parses explicit public values', () => {
    expect(
      parseEnvironment({
        VITE_API_URL: 'https://api.example.test/v1',
        VITE_ENABLE_API_MOCKING: 'false',
        DEV: true,
        PROD: false,
      }),
    ).toMatchObject({
      API_URL: 'https://api.example.test/v1',
      ENABLE_API_MOCKING: false,
    })
  })

  it('rejects invalid public values as validation errors', () => {
    expect(() =>
      parseEnvironment({
        VITE_API_URL: 'not a URL',
        VITE_ENABLE_API_MOCKING: 'yes' as 'true',
        DEV: true,
        PROD: false,
      }),
    ).toThrow(
      expect.objectContaining<Partial<ApiError>>({ kind: 'validation' }),
    )
  })
})
