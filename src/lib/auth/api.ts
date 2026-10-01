import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
import type { MutationConfig, QueryConfig } from '@/lib/react-query'
import {
  authenticatedAuthSessionSchema,
  authSessionSchema,
  loginInputSchema,
  logoutResponseSchema,
  type LoginInput,
} from './model'

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
}

function csrfHeaders(csrfToken: string) {
  return { 'X-CSRF-Token': csrfToken }
}

export async function getAuthSession() {
  return apiClient.get('/auth/session', {
    responseSchema: authSessionSchema,
    authenticationFailure: 'ignore',
  })
}

export function getAuthSessionQueryOptions() {
  return queryOptions({
    queryKey: authKeys.session(),
    queryFn: getAuthSession,
    staleTime: Number.POSITIVE_INFINITY,
    meta: { requiresAuth: false },
  })
}

export function useAuthSession(
  queryConfig?: QueryConfig<typeof getAuthSessionQueryOptions>,
) {
  const options = getAuthSessionQueryOptions()
  return useQuery({ ...queryConfig, ...options })
}

function parseLoginInput(input: LoginInput) {
  try {
    return loginInputSchema.parse(input)
  } catch (error) {
    throw normalizeApiError(error, {
      validationPhase: 'request',
      requestOrigin: 'input',
    })
  }
}

export async function login(input: LoginInput, csrfToken: string) {
  return apiClient.post('/auth/login', {
    body: parseLoginInput(input),
    headers: csrfHeaders(csrfToken),
    responseSchema: authenticatedAuthSessionSchema,
    authenticationFailure: 'ignore',
  })
}

export function useLogin(
  csrfToken: string,
  mutationConfig?: MutationConfig<
    (input: LoginInput) => ReturnType<typeof login>
  >,
) {
  return useMutation({
    ...mutationConfig,
    mutationFn: (input: LoginInput) => login(input, csrfToken),
  })
}

export async function refreshSession(csrfToken: string) {
  return apiClient.post('/auth/refresh', {
    headers: csrfHeaders(csrfToken),
    responseSchema: authSessionSchema,
    authenticationFailure: 'ignore',
  })
}

export async function logout(csrfToken: string) {
  return apiClient.post('/auth/logout', {
    headers: csrfHeaders(csrfToken),
    responseSchema: logoutResponseSchema,
    authenticationFailure: 'ignore',
  })
}
