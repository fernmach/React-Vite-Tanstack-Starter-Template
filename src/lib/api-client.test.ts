import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { apiClient } from './api-client'

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
    ).rejects.toMatchObject({ kind: 'validation' })
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
    })
    expect(JSON.parse(receivedData ?? '')).toEqual({ active: false })
  })

  it('normalizes transport failures without leaking the transport message', async () => {
    await expect(
      apiClient.get('/instructions', {
        responseSchema: z.unknown(),
        adapter: async (config) => {
          throw { isAxiosError: true, code: 'ERR_NETWORK', config }
        },
      }),
    ).rejects.toMatchObject({
      kind: 'network',
      message: 'Unable to reach the server. Please try again.',
    })
  })
})
