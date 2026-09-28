import axios, { type AxiosRequestConfig, type Method } from 'axios'
import { type ZodType } from 'zod'
import { env } from '@/config/env'
import { normalizeApiError } from './api-error'

const axiosInstance = axios.create({
  baseURL: env.API_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
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
  try {
    const response = await axiosInstance.request<unknown>({
      ...config,
      method,
      url: path,
      data: body,
    })
    return responseSchema.parse(response.data)
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export const apiClient: ApiClient = {
  get: (path, options) => request('GET', path, options),
  post: (path, options) => request('POST', path, options),
  put: (path, options) => request('PUT', path, options),
  patch: (path, options) => request('PATCH', path, options),
  delete: (path, options) => request('DELETE', path, options),
}
