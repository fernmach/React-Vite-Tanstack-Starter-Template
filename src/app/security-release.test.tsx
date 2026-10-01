import { useEffect, useState } from 'react'
import userEvent from '@testing-library/user-event'
import { useMutation } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { ApiErrorEffects } from '@/app/api-error-effects'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { Toaster } from '@/components/ui/sonner'
import { LoginForm } from '@/features/auth/components/login-form'
import { setInstructionActive } from '@/features/instructions/api/set-instruction-active'
import { instructionKeys } from '@/features/instructions/api/instruction-keys'
import { ApiError } from '@/lib/api-error'
import {
  publishAuthenticationRequired,
  resetAuthenticationRequiredEpisode,
} from '@/lib/api-events'
import { authKeys } from '@/lib/auth/api'
import { useAuth, type AuthContextValue } from '@/lib/auth/context'
import type { AuthSession } from '@/lib/auth/model'
import { AuthProvider } from '@/lib/auth/provider'
import { errorReporting } from '@/lib/error-reporting'
import {
  AUTH_TEST_ACCOUNTS,
  currentMockCsrfToken,
  refreshMockSession,
  revokeMockRefresh,
} from '@/mocks/auth-store'
import { server } from '@/mocks/server'
import { act, fireEvent, render, screen, waitFor } from '@/test/render'

afterEach(() => {
  resetAuthenticationRequiredEpisode()
  errorReporting.configure({ reporter: undefined, development: false })
  act(() => toast.dismiss())
  vi.restoreAllMocks()
})

function Effects({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <ApiErrorEffects />
      {children}
      <Toaster position="bottom-right" closeButton richColors />
    </NotificationProvider>
  )
}

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
      <dt>Archive permission</dt>
      <dd>{auth.can('instructions:archive') ? 'yes' : 'no'}</dd>
    </dl>
  )
}

function LoginJourney() {
  const auth = useAuth()
  return (
    <>
      <AuthProbe />
      {auth.status === 'anonymous' ? (
        <LoginForm onAuthenticated={() => undefined} />
      ) : null}
    </>
  )
}

function InstructionMutation({ onRequest }: { onRequest: () => void }) {
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async () => {
      onRequest()
      return setInstructionActive({
        id: 'instruction-186681',
        active: false,
      })
    },
    onError: (failure) =>
      setError(
        failure instanceof ApiError && failure.status === 403
          ? 'forbidden'
          : 'failed',
      ),
  })
  return (
    <>
      <button onClick={() => mutation.mutate()}>Change state</button>
      {error ? <p>{error}</p> : null}
    </>
  )
}

describe('cross-feature security release matrix', () => {
  it('starts anonymously and handles invalid then valid login without leaking secrets', async () => {
    const user = userEvent.setup()
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const rawSecret = 'RAW-BACKEND-PASSWORD-DETAIL'
    let loginAttempts = 0
    server.use(
      http.post('*/auth/login', async ({ request }) => {
        loginAttempts += 1
        if (loginAttempts === 1) {
          return HttpResponse.json(
            { message: rawSecret, code: 'INVALID_CREDENTIALS' },
            { status: 401 },
          )
        }
        const body = (await request.json()) as {
          email: string
          password: string
        }
        expect(body.password).toBe(AUTH_TEST_ACCOUNTS.EDITOR.password)
        return HttpResponse.json({
          user: AUTH_TEST_ACCOUNTS.EDITOR.user,
          csrfToken: 'rotated-release-csrf',
        })
      }),
    )

    render(
      <AuthProvider>
        <LoginJourney />
      </AuthProvider>,
    )
    await screen.findByText('anonymous')

    await user.type(
      screen.getByLabelText('E-mail'),
      AUTH_TEST_ACCOUNTS.EDITOR.email,
    )
    await user.type(screen.getByLabelText('Senha'), `wrong-${rawSecret}{Enter}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos.',
    )
    expect(document.body).not.toHaveTextContent(rawSecret)

    await user.clear(screen.getByLabelText('Senha'))
    await user.type(
      screen.getByLabelText('Senha'),
      `${AUTH_TEST_ACCOUNTS.EDITOR.password}{Enter}`,
    )
    await screen.findByText('authenticated')
    expect(screen.getByText(AUTH_TEST_ACCOUNTS.EDITOR.email)).toBeVisible()

    const observableOutput = JSON.stringify({
      url: window.location.href,
      storage: storageWrite.mock.calls,
      reports: reporter.mock.calls,
      errors: consoleError.mock.calls,
      logs: consoleLog.mock.calls,
    })
    expect(observableOutput).not.toContain(rawSecret)
    expect(observableOutput).not.toContain(AUTH_TEST_ACCOUNTS.EDITOR.password)
    expect(observableOutput).not.toContain('rotated-release-csrf')
    expect(storageWrite).not.toHaveBeenCalled()
  })

  it('coalesces concurrent expiry and adopts authoritative permission changes', async () => {
    const refreshRequests = vi.fn()
    server.use(
      http.post('*/auth/refresh', () => {
        refreshRequests()
        return HttpResponse.json({
          user: AUTH_TEST_ACCOUNTS.EDITOR.user,
          csrfToken: 'authoritative-rotation',
        })
      }),
    )
    const rendered = render(
      <Effects>
        <AuthProbe />
      </Effects>,
      { auth: 'admin' },
    )
    const publicKey = instructionKeys.list({
      page: 1,
      pageSize: 10,
      term: '',
    })
    rendered.queryClient.setQueryData(publicKey, {
      marker: 'public instructions',
    })

    expect(screen.getByText('yes')).toBeVisible()
    act(() => {
      publishAuthenticationRequired('access-expired-a')
      publishAuthenticationRequired('access-expired-b')
    })

    await screen.findByText(AUTH_TEST_ACCOUNTS.EDITOR.email)
    expect(refreshRequests).toHaveBeenCalledOnce()
    expect(screen.getByText('no')).toBeVisible()
    expect(rendered.queryClient.getQueryData(publicKey)).toEqual({
      marker: 'public instructions',
    })
    expect(
      rendered.queryClient.getQueryData<AuthSession>(authKeys.session())
        ?.csrfToken,
    ).toBe('authoritative-rotation')
  })

  it('signs out after revoked refresh while preserving public instruction data', async () => {
    const rendered = render(
      <Effects>
        <AuthProbe />
      </Effects>,
      { auth: 'editor' },
    )
    revokeMockRefresh()
    const publicKey = instructionKeys.list({
      page: 1,
      pageSize: 10,
      term: '',
    })
    rendered.queryClient.setQueryData(publicKey, {
      marker: 'public instructions',
    })
    rendered.queryClient.setQueryDefaults(['private-release'], {
      meta: { requiresAuth: true },
    })
    rendered.queryClient.setQueryData(['private-release'], 'private')

    act(() => publishAuthenticationRequired('revoked-refresh'))

    await screen.findByText('anonymous')
    expect(
      rendered.queryClient.getQueryData(['private-release']),
    ).toBeUndefined()
    expect(rendered.queryClient.getQueryData(publicKey)).toEqual({
      marker: 'public instructions',
    })
    await waitFor(() =>
      expect(screen.getByText('Sessão expirada')).toBeVisible(),
    )
    expect(document.body).not.toHaveTextContent(currentMockCsrfToken())
  })

  it.each([
    ['success', false],
    ['transport failure', true],
  ])(
    'cleans local auth and private cache after logout %s',
    async (_label, fails) => {
      if (fails)
        server.use(http.post('*/auth/logout', () => HttpResponse.error()))
      let auth!: AuthContextValue
      const rendered = render(
        <AuthProbe capture={(value) => (auth = value)} />,
        {
          auth: 'admin',
        },
      )
      rendered.queryClient.setQueryDefaults(['logout-private'], {
        meta: { requiresAuth: true },
      })
      rendered.queryClient.setQueryData(['logout-private'], 'private')
      rendered.queryClient.setQueryData(['logout-public'], 'public')

      const result = auth.logout()
      if (fails) await expect(result).rejects.toMatchObject({ kind: 'network' })
      else await expect(result).resolves.toBeUndefined()

      await waitFor(() => expect(auth.status).toBe('anonymous'))
      expect(
        rendered.queryClient.getQueryData(['logout-private']),
      ).toBeUndefined()
      expect(rendered.queryClient.getQueryData(['logout-public'])).toBe(
        'public',
      )
    },
  )

  it('treats forbidden access separately and never replays a failed mutation', async () => {
    const refreshRequests = vi.fn(() => HttpResponse.json(refreshMockSession()))
    const mutationRequests = vi.fn()
    server.use(
      http.post('*/auth/refresh', refreshRequests),
      http.patch('*/instructions/*', () =>
        mutationRequests.mock.calls.length === 1
          ? HttpResponse.json(
              { message: 'forbidden detail', code: 'FORBIDDEN' },
              { status: 403 },
            )
          : HttpResponse.json(
              { message: 'expired detail', code: 'AUTHENTICATION_REQUIRED' },
              { status: 401 },
            ),
      ),
    )
    render(
      <Effects>
        <InstructionMutation onRequest={mutationRequests} />
        <AuthProbe />
      </Effects>,
      { auth: 'editor' },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Change state' }))
    await screen.findByText('forbidden')
    expect(refreshRequests).not.toHaveBeenCalled()
    expect(mutationRequests).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Change state' }))
    await waitFor(() => expect(refreshRequests).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mutationRequests).toHaveBeenCalledTimes(2)
  })
})
