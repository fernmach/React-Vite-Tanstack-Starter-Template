import { QueryClient } from '@tanstack/react-query'
import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { authKeys } from './api'
import { requireAuthentication, requirePermission } from './route-guards'
import { AUTH_TEST_ACCOUNTS } from '@/mocks/auth-store'

function contextFor(
  user: (typeof AUTH_TEST_ACCOUNTS)['EDITOR']['user'] | null,
) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(authKeys.session(), {
    user,
    csrfToken: 'guard-csrf',
  })
  return { queryClient }
}

describe('authentication route guards', () => {
  it('returns the authenticated user', async () => {
    const user = AUTH_TEST_ACCOUNTS.EDITOR.user
    await expect(
      requireAuthentication({
        context: contextFor(user),
        location: { href: '/instrucoes?pagina=2#resultado' },
      }),
    ).resolves.toEqual(user)
  })

  it('redirects an anonymous visitor to login with a safe destination', async () => {
    const result = requireAuthentication({
      context: contextFor(null),
      location: { href: '/instrucoes?pagina=2#resultado' },
    })

    await expect(result).rejects.toSatisfy(isRedirect)
    await expect(result).rejects.toMatchObject({
      options: {
        to: '/login',
        search: { redirect: '/instrucoes?pagina=2#resultado' },
      },
    })
  })

  it('drops an unsafe destination before redirecting to login', async () => {
    await expect(
      requireAuthentication({
        context: contextFor(null),
        location: { href: '//evil.example/steal' },
      }),
    ).rejects.toMatchObject({
      options: { search: { redirect: undefined } },
    })
  })

  it('allows a user with the required permission', async () => {
    await expect(
      requirePermission('instructions:update')({
        context: contextFor(AUTH_TEST_ACCOUNTS.EDITOR.user),
        location: { href: '/instrucoes/1/editar' },
      }),
    ).resolves.toEqual(AUTH_TEST_ACCOUNTS.EDITOR.user)
  })

  it('redirects a signed-in user without the required permission', async () => {
    await expect(
      requirePermission('instructions:archive')({
        context: contextFor(AUTH_TEST_ACCOUNTS.EDITOR.user),
        location: { href: '/instrucoes/1/arquivar' },
      }),
    ).rejects.toMatchObject({
      options: { href: '/instrucoes' },
    })
  })
})
