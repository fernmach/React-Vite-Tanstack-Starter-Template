import { useCallback, useMemo, type PropsWithChildren } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-error'
import { AuthContext, type AuthContextValue } from './context'
import {
  authKeys,
  getAuthSession,
  getAuthSessionQueryOptions,
  login as loginRequest,
  logout as logoutRequest,
  useAuthSession,
} from './api'
import type { AuthSession, AuthStatus, LoginInput } from './model'

function sessionStatus({
  isPending,
  isFetching,
  isError,
  data,
  errorUpdatedAt,
}: ReturnType<typeof useAuthSession>): AuthStatus {
  if (isFetching && (data !== undefined || errorUpdatedAt > 0)) {
    return 'recovering'
  }
  if (isPending) return 'loading'
  if (isError) return 'error'
  return data.user ? 'authenticated' : 'anonymous'
}

function asApiError(error: Error | null): ApiError | null {
  return error instanceof ApiError ? error : null
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const sessionQuery = useAuthSession()

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const currentSession = await queryClient.ensureQueryData(
        getAuthSessionQueryOptions(),
      )
      return loginRequest(input, currentSession.csrfToken)
    },
    onSuccess: (session) => {
      queryClient.setQueryData(authKeys.session(), session)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const currentSession = await queryClient.ensureQueryData(
        getAuthSessionQueryOptions(),
      )
      await logoutRequest(currentSession.csrfToken)

      try {
        return await getAuthSession()
      } catch {
        return { user: null, csrfToken: currentSession.csrfToken }
      }
    },
  })

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await loginMutation.mutateAsync(input)
      return session.user
    },
    [loginMutation],
  )

  const logout = useCallback(async () => {
    const currentSession = queryClient.getQueryData<AuthSession>(
      authKeys.session(),
    )
    let nextSession: AuthSession | undefined
    let operationError: unknown

    try {
      nextSession = await logoutMutation.mutateAsync()
    } catch (error) {
      operationError = error
    }

    let cleanupError: unknown
    try {
      await queryClient.cancelQueries({
        predicate: (query) => query.meta?.requiresAuth === true,
      })
    } catch (error) {
      cleanupError = error
    }

    try {
      queryClient.removeQueries({
        predicate: (query) => query.meta?.requiresAuth === true,
      })
    } catch (error) {
      cleanupError ??= error
    }

    try {
      const csrfToken = nextSession?.csrfToken ?? currentSession?.csrfToken
      if (csrfToken) {
        queryClient.setQueryData(authKeys.session(), {
          user: null,
          csrfToken,
        } satisfies AuthSession)
      } else {
        queryClient.removeQueries({ queryKey: authKeys.session(), exact: true })
      }
    } catch (error) {
      cleanupError ??= error
    }

    if (operationError) throw operationError
    if (cleanupError) throw cleanupError
  }, [logoutMutation, queryClient])

  const retrySession = useCallback(async () => {
    const result = await sessionQuery.refetch({ cancelRefetch: false })
    if (result.error) throw result.error
  }, [sessionQuery])

  const user = sessionQuery.data?.user ?? null
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status: sessionStatus(sessionQuery),
      error: asApiError(sessionQuery.error),
      login,
      logout,
      retrySession,
      hasRole: (...roles) =>
        user !== null && roles.some((role) => user.roles.includes(role)),
      can: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [user, sessionQuery, login, logout, retrySession],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
