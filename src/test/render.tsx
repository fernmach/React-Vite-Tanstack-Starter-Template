import type { ReactElement } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  render as testingLibraryRender,
  renderHook as testingLibraryRenderHook,
  type RenderHookOptions,
  type RenderOptions,
} from '@testing-library/react'
import { createQueryClient } from '@/lib/react-query'
import { authKeys } from '@/lib/auth/api'
import { AuthProvider } from '@/lib/auth/provider'
import type { AuthSession } from '@/lib/auth/model'
import { authenticateMockAs, currentMockCsrfToken } from '@/mocks/auth-store'

type AuthRenderState = 'anonymous' | 'editor' | 'admin'

function sessionForAuthState(auth: AuthRenderState): AuthSession {
  if (auth === 'anonymous') {
    return { user: null, csrfToken: currentMockCsrfToken() }
  }
  return authenticateMockAs(auth === 'editor' ? 'EDITOR' : 'ADMIN')
}

function seedAuth(queryClient: QueryClient, auth?: AuthRenderState) {
  if (auth)
    queryClient.setQueryData(authKeys.session(), sessionForAuthState(auth))
}

type QueryRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  queryClient?: QueryClient
  auth?: AuthRenderState
}

export function render(
  ui: ReactElement,
  {
    queryClient = createQueryClient(),
    auth,
    ...options
  }: QueryRenderOptions = {},
) {
  seedAuth(queryClient, auth)
  return {
    queryClient,
    ...testingLibraryRender(ui, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {auth ? <AuthProvider>{children}</AuthProvider> : children}
        </QueryClientProvider>
      ),
      ...options,
    }),
  }
}

type QueryRenderHookOptions<Props> = Omit<
  RenderHookOptions<Props>,
  'wrapper'
> & {
  queryClient?: QueryClient
  auth?: AuthRenderState
}

export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  {
    queryClient = createQueryClient(),
    auth,
    ...options
  }: QueryRenderHookOptions<Props> = {},
) {
  seedAuth(queryClient, auth)
  return {
    queryClient,
    ...testingLibraryRenderHook(callback, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {auth ? <AuthProvider>{children}</AuthProvider> : children}
        </QueryClientProvider>
      ),
      ...options,
    }),
  }
}

export { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
