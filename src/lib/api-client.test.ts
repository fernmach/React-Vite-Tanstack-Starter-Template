import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { apiClient } from './api-client'
import { isApiCancellation } from './api-error'
import {
  resetAuthenticationRequiredEpisode,
  subscribeAuthenticationRequired,
} from './api-events'

afterEach(() => resetAuthenticationRequiredEpisode())

type Adapter = Extract<
  NonNullable<Parameters<typeof apiClient.get>[1]['adapter']>,
  (...args: never[]) => unknown
>
type AdapterConfig = Parameters<Adapter>[0]
type AdapterResponse = Awaited<ReturnType<Adapter>>

function response(
  data: unknown,
  config: AdapterConfig,
  status = 200,
): AdapterResponse {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  }
}

describe('apiClient', () => {
  it('configures the single Axios instance and validates response data', async () => {
    let receivedConfig: AdapterConfig | undefined
    const schema = z.object({ id: z.string() })

    const result = await apiClient.get('/instructions/123', {
      params: { include: 'summary' },
      responseSchema: schema,
      adapter: async (config) => {
        receivedConfig = config
        return response({ id: '123' }, config)
      },
    })

    expect(result).toEqual({ id: '123' })
    expect(receivedConfig).toMatchObject({
      baseURL: '/api',
      method: 'get',
      url: '/instructions/123',
      params: { include: 'summary' },
      withCredentials: true,
    })
    expect(receivedConfig?.headers.get('Accept')).toBe('application/json')
    expect(receivedConfig?.headers.get('Content-Type')).toBe('application/json')
  })

  it('normalizes invalid successful responses', async () => {
    await expect(
      apiClient.get('/instructions/123', {
        responseSchema: z.object({ id: z.string() }),
        adapter: async (config) => response({ id: 123 }, config),
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      validationPhase: 'response',
      issueCodes: ['invalid_type'],
    })
  })

  it('sends JSON bodies and normalizes HTTP failures', async () => {
    let receivedData: string | undefined

    await expect(
      apiClient.patch('/instructions/123', {
        body: { active: false },
        responseSchema: z.unknown(),
        adapter: async (config) => {
          receivedData = config.data as string
          throw {
            isAxiosError: true,
            code: 'ERR_BAD_REQUEST',
            response: response(
              { message: 'Rejected.', code: 'REJECTED' },
              config,
              422,
            ),
          }
        },
      }),
    ).rejects.toMatchObject({
      kind: 'http',
      status: 422,
      code: 'REJECTED',
      codeSource: 'backend',
      transportCode: 'ERR_BAD_REQUEST',
    })
    expect(JSON.parse(receivedData ?? '')).toEqual({ active: false })
  })

  it('normalizes transport failures without leaking the transport message', async () => {
    await expect(
      apiClient.get('/instructions', {
        responseSchema: z.unknown(),
        adapter: async (config) => {
          throw {
            isAxiosError: true,
            code: 'ERR_NETWORK',
            message: 'private transport detail',
            config,
          }
        },
      }),
    ).rejects.toMatchObject({
      kind: 'network',
      message: 'Unable to reach the server. Please try again.',
    })
  })

  it('publishes one authentication episode for concurrent 401s, including a malformed body', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(listener)
    const schema = z.unknown()
    const makeRequest = (data: unknown) =>
      apiClient.get('/private', {
        responseSchema: schema,
        adapter: async (config) => {
          throw {
            isAxiosError: true,
            code: 'ERR_BAD_REQUEST',
            message: 'private raw error',
            response: response(data, config, 401),
          }
        },
      })

    const failures = await Promise.allSettled([
      makeRequest({ message: 42 }),
      makeRequest({ message: 'No access.' }),
    ])
    expect(failures[0]).toMatchObject({
      status: 'rejected',
      reason: {
        kind: 'validation',
        validationPhase: 'error-payload',
        status: 401,
        code: undefined,
      },
    })
    expect(failures[1]).toMatchObject({
      status: 'rejected',
      reason: { kind: 'http', status: 401 },
    })
    expect(listener).toHaveBeenCalledTimes(1)

    resetAuthenticationRequiredEpisode()
    await expect(makeRequest(undefined)).rejects.toMatchObject({
      kind: 'http',
      status: 401,
    })
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('does not publish for 403 or cancellation, preserving Axios cancellation', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(listener)
    const controller = new AbortController()

    await expect(
      apiClient.get('/private', {
        responseSchema: z.unknown(),
        adapter: async (config) => {
          throw {
            isAxiosError: true,
            response: response({ message: 'Forbidden.' }, config, 403),
          }
        },
      }),
    ).rejects.toMatchObject({ kind: 'http', status: 403 })

    controller.abort()
    let cancellation: unknown
    try {
      await apiClient.get('/private', {
        responseSchema: z.unknown(),
        signal: controller.signal,
        adapter: async () => {
          throw new Error('adapter should not run for a pre-aborted signal')
        },
      })
    } catch (error) {
      cancellation = error
    }
    expect(isApiCancellation(cancellation)).toBe(true)
    expect(cancellation).toMatchObject({ code: 'ERR_CANCELED' })
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
