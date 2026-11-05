import axios, { type AxiosRequestConfig, type Method } from 'axios'
import { type ZodType } from 'zod'
import { env } from '@/config/env'
import { publishAuthenticationRequired } from './api-events'
import { isApiCancellation, normalizeApiError } from './api-error'

export type AuthenticationFailureMode = 'publish' | 'ignore'

declare module 'axios' {
  interface AxiosRequestConfig {
    authenticationFailure?: AuthenticationFailureMode
  }

  interface InternalAxiosRequestConfig {
    authenticationFailure?: AuthenticationFailureMode
  }
}

const axiosInstance = axios.create({
  baseURL: env.API_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

axiosInstance.interceptors.response.use(undefined, (error: unknown) => {
  if (isApiCancellation(error)) return Promise.reject(error)

  const normalized = normalizeApiError(error)
  const authenticationFailure = axios.isAxiosError(error)
    ? error.config?.authenticationFailure
    : undefined
  if (normalized.status === 401 && authenticationFailure !== 'ignore') {
    publishAuthenticationRequired(normalized.occurrenceId)
  }
  return Promise.reject(normalized)
})

type ApiRequestOptions<TData> = Omit<
  AxiosRequestConfig,
  'baseURL' | 'data' | 'method' | 'url'
> & {
  responseSchema: ZodType<TData>
  body?: unknown
}

type ApiClient = {
  get: <TData>(
    path: string,
    options: ApiRequestOptions<TData>,
  ) => Promise<TData>
  post: <TData>(
    path: string,
    options: ApiRequestOptions<TData>,
  ) => Promise<TData>
  put: <TData>(
    path: string,
    options: ApiRequestOptions<TData>,
  ) => Promise<TData>
  patch: <TData>(
    path: string,
    options: ApiRequestOptions<TData>,
  ) => Promise<TData>
  delete: <TData>(
    path: string,
    options: ApiRequestOptions<TData>,
  ) => Promise<TData>
}

async function request<TData>(
  method: Method,
  path: string,
  { responseSchema, body, ...config }: ApiRequestOptions<TData>,
): Promise<TData> {
  const response = await axiosInstance.request<unknown>({
    ...config,
    method,
    url: path,
    data: body,
  })
  const parsed = responseSchema.safeParse(response.data)
  if (!parsed.success) {
    throw normalizeApiError(parsed.error, { validationPhase: 'response' })
  }
  return parsed.data
}

export const apiClient: ApiClient = {
  get: (path, options) => request('GET', path, options),
  post: (path, options) => request('POST', path, options),
  put: (path, options) => request('PUT', path, options),
  patch: (path, options) => request('PATCH', path, options),
  delete: (path, options) => request('DELETE', path, options),
}
