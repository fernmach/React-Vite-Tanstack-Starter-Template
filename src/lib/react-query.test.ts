import { CancelledError, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api-error'
import { errorReporting } from './error-reporting'
import { createQueryClient } from './react-query'

afterEach(() =>
  errorReporting.configure({ reporter: undefined, development: false }),
)

describe('createQueryClient', () => {
  it('uses the shared query and mutation defaults', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions()).toEqual({
      queries: {
        staleTime: 60_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    })
  })

  it('creates an isolated cache for each app or test instance', () => {
    const first = createQueryClient()
    const second = createQueryClient()
    first.setQueryData(['sample'], 'first')

    expect(second.getQueryData(['sample'])).toBeUndefined()
  })
})

describe('cache reporting', () => {
  const cases = [
    ['network', new ApiError({ kind: 'network', message: 'private' }), false],
    [
      'authentication',
      new ApiError({ kind: 'http', status: 401, message: 'private' }),
      false,
    ],
    [
      'forbidden',
      new ApiError({ kind: 'http', status: 403, message: 'private' }),
      false,
    ],
    [
      'business rejection',
      new ApiError({ kind: 'http', status: 404, message: 'private' }),
      false,
    ],
    [
      'editable input',
      new ApiError({
        kind: 'validation',
        validationPhase: 'request',
        requestOrigin: 'input',
        message: 'private',
      }),
      false,
    ],
    [
      'internal input',
      new ApiError({
        kind: 'validation',
        validationPhase: 'request',
        requestOrigin: 'internal',
        message: 'private',
      }),
      true,
    ],
    [
      'response',
      new ApiError({
        kind: 'validation',
        validationPhase: 'response',
        message: 'private',
      }),
      true,
    ],
    [
      'malformed 401',
      new ApiError({
        kind: 'validation',
        status: 401,
        validationPhase: 'error-payload',
        message: 'private',
      }),
      true,
    ],
    [
      'server',
      new ApiError({ kind: 'http', status: 503, message: 'private' }),
      true,
    ],
    ['unknown', new Error('private'), true],
    ['cancellation', new CancelledError(), false],
  ] as const

  it.each(cases)(
    'classifies %s for both queries and mutations',
    async (_name, error, expected) => {
      const reporter = vi.fn()
      errorReporting.configure({ reporter })
      const client = createQueryClient()
      const fail = vi.fn(async () => {
        throw error
      })
      await expect(
        client.fetchQuery({ queryKey: ['secret-key'], queryFn: fail }),
      ).rejects.toBe(error)
      const mutation = client
        .getMutationCache()
        .build(client, { mutationFn: fail })
      await expect(mutation.execute(undefined)).rejects.toBe(error)
      expect(reporter).toHaveBeenCalledTimes(expected ? 2 : 0)
      expect(fail).toHaveBeenCalledTimes(2)
      expect(JSON.stringify(reporter.mock.calls)).not.toMatch(
        /private|secret-key/,
      )
      client.clear()
    },
  )

  it('reports once for shared observers, then again for an explicit refetch', async () => {
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    const client = createQueryClient()
    const error = new Error('private')
    const queryFn = vi.fn(async () => {
      throw error
    })
    const options = { queryKey: ['shared'], queryFn }
    const first = new QueryObserver(client, options)
    const second = new QueryObserver(client, options)
    const unsubscribeFirst = first.subscribe(() => {})
    const unsubscribeSecond = second.subscribe(() => {})
    await first.refetch()
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledTimes(1)
    errorReporting.report(error, { source: 'route' })
    expect(reporter).toHaveBeenCalledTimes(1)
    await first.refetch()
    expect(reporter).toHaveBeenCalledTimes(2)
    unsubscribeFirst()
    unsubscribeSecond()
    client.clear()
  })

  it('uses status-qualified feature metadata for internal backend rejections', async () => {
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    const client = createQueryClient()
    for (const status of [400, 403]) {
      const error = new ApiError({
        kind: 'http',
        status,
        code: 'INTERNAL_INPUT',
        codeSource: 'backend',
        message: 'private',
      })
      await expect(
        client.fetchQuery({
          queryKey: ['metadata', status],
          queryFn: async () => {
            throw error
          },
          meta: {
            requestContractErrors: [{ status: 400, code: 'INTERNAL_INPUT' }],
          },
        }),
      ).rejects.toBe(error)
    }
    expect(reporter).toHaveBeenCalledExactlyOnceWith({
      source: 'query',
      category: 'contract',
      status: 400,
    })
    client.clear()
  })

  it('does not let reporter failures replace errors or block mutation recovery callbacks', async () => {
    errorReporting.configure({
      reporter: () => {
        throw new Error('reporter failed')
      },
    })
    const client = createQueryClient()
    const original = new Error('original')
    const onError = vi.fn()
    const onSettled = vi.fn()
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => {
        throw original
      },
      onError,
      onSettled,
    })
    await expect(mutation.execute(undefined)).rejects.toBe(original)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledTimes(1)
    client.clear()
  })
})
