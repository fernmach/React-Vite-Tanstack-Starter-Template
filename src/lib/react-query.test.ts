import { describe, expect, it } from 'vitest'
import { createQueryClient } from './react-query'

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
