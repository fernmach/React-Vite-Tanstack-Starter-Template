import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { getAuthSessionQueryOptions } from './api'
import type { AuthUser, Permission } from './model'
import { authRedirectOrDefault, safeAuthRedirect } from './redirect'

export type AuthRouteContext = {
  queryClient: QueryClient
}

type GuardInput = {
  context: AuthRouteContext
  location: { href: string }
}

export async function requireAuthentication({
  context,
  location,
}: GuardInput): Promise<AuthUser> {
  const session = await context.queryClient.ensureQueryData(
    getAuthSessionQueryOptions(),
  )

  if (!session.user) {
    throw redirect({
      to: '/login',
      search: { redirect: safeAuthRedirect(location.href) },
    })
  }

  return session.user
}

export function requirePermission(permission: Permission) {
  return async (input: GuardInput): Promise<AuthUser> => {
    const user = await requireAuthentication(input)
    if (!user.permissions.includes(permission)) {
      throw redirect({ href: authRedirectOrDefault(undefined) })
    }
    return user
  }
}
