import { useEffect } from 'react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@/test/render'
import { server } from '@/mocks/server'
import { AUTH_TEST_ACCOUNTS } from '@/mocks/auth-store'
import { authKeys } from './api'
import { useAuth, type AuthContextValue } from './context'
import { AuthProvider } from './provider'

function AuthProbe({
  capture,
}: {
  capture?: (auth: AuthContextValue) => void
}) {
  const auth = useAuth()
  useEffect(() => {
    capture?.(auth)
  }, [auth, capture])

  return (
    <dl>
      <dt>Status</dt>
      <dd>{auth.status}</dd>
      <dt>User</dt>
      <dd>{auth.user?.email ?? 'none'}</dd>
      <dt>Error</dt>
      <dd>{auth.error?.kind ?? 'none'}</dd>
    </dl>
  )
}

describe('AuthProvider', () => {
  it('exposes loading before resolving an anonymous startup session', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('*/auth/session', async () => {
        await pending
        return HttpResponse.json({ user: null, csrfToken: 'delayed-csrf' })
      }),
    )

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    expect(screen.getByText('loading')).toBeInTheDocument()

    release()
    await screen.findByText('anonymous')
    expect(screen.getAllByText('none')).toHaveLength(2)
  })

  it('exposes authenticated editor and administrator sessions', () => {
    const editor = render(<AuthProbe />, { auth: 'editor' })
    expect(screen.getByText('authenticated')).toBeInTheDocument()
    expect(
      screen.getByText(AUTH_TEST_ACCOUNTS.EDITOR.email),
    ).toBeInTheDocument()
    editor.unmount()

    render(<AuthProbe />, { auth: 'admin' })
    expect(screen.getByText(AUTH_TEST_ACCOUNTS.ADMIN.email)).toBeInTheDocument()
  })

  it('updates the canonical session cache after a successful validated login', async () => {
    let auth!: AuthContextValue
    const rendered = render(<AuthProbe capture={(value) => (auth = value)} />, {
      auth: 'anonymous',
    })

    let user
    await act(async () => {
      user = await auth.login({
        email: AUTH_TEST_ACCOUNTS.EDITOR.email,
        password: AUTH_TEST_ACCOUNTS.EDITOR.password,
      })
    })

    expect(user).toEqual(AUTH_TEST_ACCOUNTS.EDITOR.user)
    await waitFor(() => expect(auth.status).toBe('authenticated'))
    expect(auth.user).toEqual(AUTH_TEST_ACCOUNTS.EDITOR.user)
    expect(rendered.queryClient.getQueryData(authKeys.session())).toMatchObject(
      {
        user: AUTH_TEST_ACCOUNTS.EDITOR.user,
      },
    )
  })

  it('does not corrupt an authenticated cache when login is rejected', async () => {
    let auth!: AuthContextValue
    const rendered = render(<AuthProbe capture={(value) => (auth = value)} />, {
      auth: 'editor',
    })
    const before = rendered.queryClient.getQueryData(authKeys.session())

    await expect(
      auth.login({
        email: AUTH_TEST_ACCOUNTS.ADMIN.email,
        password: 'incorrect-password',
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })

    expect(rendered.queryClient.getQueryData(authKeys.session())).toEqual(
      before,
    )
    expect(auth.user).toEqual(AUTH_TEST_ACCOUNTS.EDITOR.user)
  })

  it('does not cache a malformed successful login response', async () => {
    server.use(
      http.post('*/auth/login', () =>
        HttpResponse.json({ user: null, csrfToken: 'unexpected-csrf' }),
      ),
    )
    let auth!: AuthContextValue
    const rendered = render(<AuthProbe capture={(value) => (auth = value)} />, {
      auth: 'anonymous',
    })
    const before = rendered.queryClient.getQueryData(authKeys.session())

    await expect(
      auth.login({
        email: AUTH_TEST_ACCOUNTS.EDITOR.email,
        password: AUTH_TEST_ACCOUNTS.EDITOR.password,
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      validationPhase: 'response',
    })

    expect(rendered.queryClient.getQueryData(authKeys.session())).toEqual(
      before,
    )
    expect(auth.status).toBe('anonymous')
  })

  it('logs out to a fresh anonymous session', async () => {
    let auth!: AuthContextValue
    const rendered = render(<AuthProbe capture={(value) => (auth = value)} />, {
      auth: 'admin',
    })
    const previous = rendered.queryClient.getQueryData<{ csrfToken: string }>(
      authKeys.session(),
    )

    await act(async () => {
      await auth.logout()
    })

    await waitFor(() => expect(auth.status).toBe('anonymous'))
    expect(auth.user).toBeNull()
    expect(
      rendered.queryClient.getQueryData<{ csrfToken: string }>(
        authKeys.session(),
      )?.csrfToken,
    ).not.toBe(previous?.csrfToken)
  })

  it('clears local session and protected queries when logout transport fails', async () => {
    server.use(http.post('*/auth/logout', () => HttpResponse.error()))
    let auth!: AuthContextValue
    const rendered = render(<AuthProbe capture={(value) => (auth = value)} />, {
      auth: 'admin',
    })
    rendered.queryClient.setQueryDefaults(['protected'], {
      meta: { requiresAuth: true },
    })
    rendered.queryClient.setQueryData(['protected'], 'secret')
    rendered.queryClient.setQueryData(['public'], 'visible')

    await expect(auth.logout()).rejects.toMatchObject({ kind: 'network' })

    await waitFor(() => expect(auth.status).toBe('anonymous'))
    expect(auth.user).toBeNull()
    expect(rendered.queryClient.getQueryData(['protected'])).toBeUndefined()
    expect(rendered.queryClient.getQueryData(['public'])).toBe('visible')
  })

  it('exposes recovering and succeeds when retrying a startup failure', async () => {
    let requestCount = 0
    let releaseRetry!: () => void
    const retryPending = new Promise<void>((resolve) => {
      releaseRetry = resolve
    })
    server.use(
      http.get('*/auth/session', async () => {
        requestCount += 1
        if (requestCount === 1) {
          return HttpResponse.json(
            { message: 'Unavailable', code: 'UNAVAILABLE' },
            { status: 503 },
          )
        }
        await retryPending
        return HttpResponse.json({ user: null, csrfToken: 'retry-csrf' })
      }),
    )
    let auth!: AuthContextValue
    render(
      <AuthProvider>
        <AuthProbe capture={(value) => (auth = value)} />
      </AuthProvider>,
    )
    await screen.findByText('error')
    expect(auth.error).toMatchObject({ kind: 'http', status: 503 })

    let retry!: Promise<void>
    act(() => {
      retry = auth.retrySession()
    })
    await screen.findByText('recovering')
    releaseRetry()
    await act(() => retry)

    await waitFor(() => expect(auth.status).toBe('anonymous'))
    expect(auth.error).toBeNull()
  })

  it('checks roles coarsely and permissions generically', () => {
    const { result } = renderHook(() => useAuth(), { auth: 'editor' })

    expect(result.current.hasRole('EDITOR')).toBe(true)
    expect(result.current.hasRole('ADMIN')).toBe(false)
    expect(result.current.hasRole('ADMIN', 'EDITOR')).toBe(true)
    expect(result.current.can('instructions:update')).toBe(true)
    expect(result.current.can('instructions:archive')).toBe(false)
  })

  it('reports malformed startup sessions as an authentication error state', async () => {
    server.use(
      http.get('*/auth/session', () =>
        HttpResponse.json({ user: { id: 42 }, csrfToken: '' }),
      ),
    )
    let auth!: AuthContextValue
    render(
      <AuthProvider>
        <AuthProbe capture={(value) => (auth = value)} />
      </AuthProvider>,
    )

    await screen.findByText('error')
    expect(auth.error).toMatchObject({
      kind: 'validation',
      validationPhase: 'response',
    })
  })

  it('rejects useAuth outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider',
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})
