import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { errorReporting } from '@/lib/error-reporting'
import { createQueryClient } from '@/lib/react-query'
import {
  resetAuthenticationRequiredEpisode,
  subscribeAuthenticationRequired,
} from '@/lib/api-events'
import { server } from '@/mocks/server'
import { instructionsUrl } from '@/mocks/instructions-handlers'
import {
  getInstructions,
  getInstructionsQueryOptions,
  normalizeInstructionsInput,
  useInstructions,
} from './get-instructions'
import { instructionKeys } from './instruction-keys'
import { renderHook, waitFor } from '@/test/render'

describe('getInstructions', () => {
  it('reports a malformed 401 once while preserving the authentication event', async () => {
    resetAuthenticationRequiredEpisode()
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    const auth = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(auth)
    const client = createQueryClient()
    server.use(
      http.get(instructionsUrl, () =>
        HttpResponse.json({ secret: 'private body' }, { status: 401 }),
      ),
    )
    try {
      await expect(
        client.fetchQuery(getInstructionsQueryOptions()),
      ).rejects.toMatchObject({ validationPhase: 'error-payload', status: 401 })
      expect(auth).toHaveBeenCalledTimes(1)
      expect(reporter).toHaveBeenCalledTimes(1)
      expect(reporter).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'query',
          category: 'contract',
          status: 401,
        }),
      )
      expect(JSON.stringify(reporter.mock.calls)).not.toContain('private body')
    } finally {
      unsubscribe()
      client.clear()
      resetAuthenticationRequiredEpisode()
      errorReporting.configure({ reporter: undefined, development: false })
    }
  })

  it('reports the feature-owned internal pagination rejection through Query', async () => {
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    const client = createQueryClient()
    server.use(
      http.get(instructionsUrl, () =>
        HttpResponse.json(
          { message: 'private diagnostic', code: 'INVALID_PAGINATION' },
          { status: 400 },
        ),
      ),
    )
    try {
      await expect(
        client.fetchQuery(getInstructionsQueryOptions()),
      ).rejects.toMatchObject({ status: 400 })
      expect(reporter).toHaveBeenCalledExactlyOnceWith({
        source: 'query',
        category: 'contract',
        status: 400,
      })
    } finally {
      client.clear()
      errorReporting.configure({ reporter: undefined, development: false })
    }
  })
  it('normalizes defaults and produces stable keys from every list input', () => {
    const normalized = normalizeInstructionsInput({ term: '  montagem  ' })
    const explicit = normalizeInstructionsInput({
      term: 'montagem',
      page: 1,
      pageSize: 20,
    })

    expect(normalized).toEqual({ term: 'montagem', page: 1, pageSize: 20 })
    expect(
      getInstructionsQueryOptions({ term: ' montagem ' }).queryKey,
    ).toEqual(instructionKeys.list(explicit))
    expect(getInstructionsQueryOptions().meta?.requiresAuth).toBe(false)
    expect(instructionKeys.list({ ...explicit, page: 2 })).not.toEqual(
      instructionKeys.list(explicit),
    )
    expect(instructionKeys.list({ ...explicit, pageSize: 10 })).not.toEqual(
      instructionKeys.list(explicit),
    )
  })

  it('sends normalized query parameters and parses the direct page response', async () => {
    let requestUrl: URL | undefined
    server.use(
      http.get(instructionsUrl, ({ request }) => {
        requestUrl = new URL(request.url)
        return HttpResponse.json({
          items: [],
          page: 2,
          pageSize: 7,
          total: 0,
          first: 0,
          last: 0,
          totalPages: 1,
        })
      }),
    )

    await expect(
      getInstructions({ term: '  acabamento ', page: 2, pageSize: 7 }),
    ).resolves.toEqual({
      items: [],
      page: 2,
      pageSize: 7,
      total: 0,
      first: 0,
      last: 0,
      totalPages: 1,
    })
    expect(requestUrl?.searchParams.get('term')).toBe('acabamento')
    expect(requestUrl?.searchParams.get('page')).toBe('2')
    expect(requestUrl?.searchParams.get('pageSize')).toBe('7')
  })

  it('rejects malformed inputs and responses as validation ApiErrors', async () => {
    expect(() => normalizeInstructionsInput({ page: 0 })).toThrow(
      expect.objectContaining<Partial<ApiError>>({
        kind: 'validation',
        validationPhase: 'request',
        requestOrigin: 'internal',
      }),
    )

    server.use(
      http.get(instructionsUrl, () =>
        HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          first: 0,
          last: 0,
          totalPages: 1,
          unexpected: true,
        }),
      ),
    )

    await expect(getInstructions()).rejects.toMatchObject({
      kind: 'validation',
      validationPhase: 'response',
    })
  })

  it('passes the Query cancellation signal to Axios', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(listener)
    const controller = new AbortController()
    const options = getInstructionsQueryOptions()
    const queryFn = options.queryFn
    if (!queryFn) throw new Error('Expected a query function')

    controller.abort()
    await expect(
      queryFn({
        client: new QueryClient(),
        meta: undefined,
        signal: controller.signal,
        queryKey: options.queryKey,
      }),
    ).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
    resetAuthenticationRequiredEpisode()
  })

  it('honors consumer query configuration without changing the canonical key', async () => {
    const { result } = renderHook(() =>
      useInstructions({
        input: { term: '186681' },
        queryConfig: { staleTime: 123_456 },
      }),
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items[0]?.code).toBe('186681')
  })
})
