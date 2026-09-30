import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/mocks/server'
import {
  AUTH_TEST_ACCOUNTS,
  expireMockAccess,
  revokeMockRefresh,
} from '@/mocks/auth-store'
import {
  publishAuthenticationRequired,
  resetAuthenticationRequiredEpisode,
  subscribeAuthenticationRequired,
} from '@/lib/api-events'
import {
  getAuthSession,
  getAuthSessionQueryOptions,
  login,
  logout,
  refreshSession,
} from './api'

describe('auth API', () => {
  it('loads an anonymous session with an in-memory CSRF token', async () => {
    const options = getAuthSessionQueryOptions()
    expect(options.queryKey).toEqual(['auth', 'session'])
    expect(options.meta).toEqual({ requiresAuth: false })

    const session = await getAuthSession()

    expect(session.user).toBeNull()
    expect(session.csrfToken).toMatch(/^mock-csrf-/)
  })

  it('rejects invalid login input before transport', async () => {
    const initial = await getAuthSession()

    await expect(
      login({ email: 'not-an-email', password: '' }, initial.csrfToken),
    ).rejects.toMatchObject({
      kind: 'validation',
      validationPhase: 'request',
      requestOrigin: 'input',
    })
    await expect(getAuthSession()).resolves.toMatchObject({ user: null })
  })

  it('logs an editor in with CSRF validation and rotates the token', async () => {
    const initial = await getAuthSession()
    const session = await login(
      {
        email: AUTH_TEST_ACCOUNTS.EDITOR.email,
        password: AUTH_TEST_ACCOUNTS.EDITOR.password,
      },
      initial.csrfToken,
    )

    expect(session.user).toMatchObject({
      email: AUTH_TEST_ACCOUNTS.EDITOR.email,
      roles: ['EDITOR'],
      permissions: [
        'instructions:create',
        'instructions:update',
        'instructions:set-active',
      ],
    })
    expect(session.csrfToken).not.toBe(initial.csrfToken)
    await expect(getAuthSession()).resolves.toEqual(session)
  })

  it('rejects missing CSRF and invalid credentials without publishing recovery', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(listener)
    const initial = await getAuthSession()

    await expect(
      login(
        {
          email: AUTH_TEST_ACCOUNTS.ADMIN.email,
          password: AUTH_TEST_ACCOUNTS.ADMIN.password,
        },
        'wrong-csrf',
      ),
    ).rejects.toMatchObject({ status: 403, code: 'CSRF_INVALID' })

    await expect(
      login(
        { email: AUTH_TEST_ACCOUNTS.ADMIN.email, password: 'wrong-password' },
        initial.csrfToken,
      ),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
    resetAuthenticationRequiredEpisode()
  })

  it('refreshes expired access once and fails safely when refresh is revoked', async () => {
    const initial = await getAuthSession()
    const authenticated = await login(
      {
        email: AUTH_TEST_ACCOUNTS.ADMIN.email,
        password: AUTH_TEST_ACCOUNTS.ADMIN.password,
      },
      initial.csrfToken,
    )
    expireMockAccess()

    await expect(getAuthSession()).rejects.toMatchObject({
      status: 401,
      code: 'ACCESS_EXPIRED',
    })
    const refreshed = await refreshSession(authenticated.csrfToken)
    expect(refreshed.user?.roles).toEqual(['ADMIN'])
    expect(refreshed.csrfToken).not.toBe(authenticated.csrfToken)

    expireMockAccess()
    revokeMockRefresh()
    await expect(refreshSession(refreshed.csrfToken)).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    })
  })

  it('logs out and exposes a fresh anonymous session', async () => {
    const initial = await getAuthSession()
    const authenticated = await login(
      {
        email: AUTH_TEST_ACCOUNTS.ADMIN.email,
        password: AUTH_TEST_ACCOUNTS.ADMIN.password,
      },
      initial.csrfToken,
    )

    await expect(logout(authenticated.csrfToken)).resolves.toEqual({
      success: true,
    })
    const anonymous = await getAuthSession()
    expect(anonymous.user).toBeNull()
    expect(anonymous.csrfToken).not.toBe(authenticated.csrfToken)
  })

  it('rejects malformed session data at the response boundary', async () => {
    server.use(
      http.get('*/auth/session', () =>
        HttpResponse.json({ user: { id: 42 }, csrfToken: '' }),
      ),
    )

    await expect(getAuthSession()).rejects.toMatchObject({
      kind: 'validation',
      validationPhase: 'response',
    })
  })

  it('keeps unrelated authentication events observable', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(listener)
    publishAuthenticationRequired('manual-test')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    resetAuthenticationRequiredEpisode()
  })
})
