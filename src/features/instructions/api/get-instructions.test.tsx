import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-error'
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
      expect.objectContaining<Partial<ApiError>>({ kind: 'validation' }),
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
    })
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
