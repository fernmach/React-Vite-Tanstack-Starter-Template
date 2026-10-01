import type { ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { Toaster } from '@/components/ui/sonner'
import { apiClient } from '@/lib/api-client'
import {
  publishAuthenticationRequired,
  resetAuthenticationRequiredEpisode,
} from '@/lib/api-events'
import { authKeys } from '@/lib/auth/api'
import { useAuth } from '@/lib/auth/context'
import type { AuthSession } from '@/lib/auth/model'
import {
  AUTH_TEST_ACCOUNTS,
  refreshMockSession,
  revokeMockRefresh,
} from '@/mocks/auth-store'
import { server } from '@/mocks/server'
import { act, fireEvent, render, screen, waitFor } from '@/test/render'
import { ApiErrorEffects } from './api-error-effects'

afterEach(() => {
  resetAuthenticationRequiredEpisode()
  act(() => toast.dismiss())
})

function EffectsHarness({ children }: { children?: ReactNode }) {
  return (
    <NotificationProvider>
      <ApiErrorEffects />
      {children}
      <Toaster position="bottom-right" closeButton richColors />
    </NotificationProvider>
  )
}

function AuthProbe() {
  const auth = useAuth()
  return (
    <dl>
      <dt>Status</dt>
      <dd>{auth.status}</dd>
      <dt>User</dt>
      <dd>{auth.user?.email ?? 'none'}</dd>
    </dl>
  )
}

function ActiveQuery({
  name,
  requiresAuth,
  queryFn,
}: {
  name: string
  requiresAuth: boolean
  queryFn: () => Promise<string>
}) {
  useQuery({
    queryKey: [name],
    queryFn,
    initialData: `cached-${name}`,
    meta: { requiresAuth },
  })
  return null
}

function FailingMutation({ onRequest }: { onRequest: () => void }) {
  const mutation = useMutation({
    mutationFn: async () => {
      onRequest()
      return apiClient.post('/private-action', {
        responseSchema: z.object({ success: z.literal(true) }),
      })
    },
  })

  return <button onClick={() => mutation.mutate()}>Run private action</button>
}

describe('ApiErrorEffects', () => {
  it('recovers once, retains the user, replaces the session, and refetches only active private queries', async () => {
    let releaseRefresh!: () => void
    const refreshPending = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const refreshRequests = vi.fn()
    server.use(
      http.post('*/auth/refresh', async () => {
        refreshRequests()
        await refreshPending
        return HttpResponse.json(refreshMockSession())
      }),
    )
    const privateQuery = vi.fn(async () => 'fresh-private')
    const publicQuery = vi.fn(async () => 'fresh-public')

    const rendered = render(
      <EffectsHarness>
        <AuthProbe />
        <ActiveQuery name="private" requiresAuth queryFn={privateQuery} />
        <ActiveQuery name="public" requiresAuth={false} queryFn={publicQuery} />
      </EffectsHarness>,
      { auth: 'editor' },
    )
    const before = rendered.queryClient.getQueryData<AuthSession>(
      authKeys.session(),
    )

    act(() => {
      publishAuthenticationRequired('first-401')
      publishAuthenticationRequired('concurrent-401')
    })

    await screen.findByText('recovering')
    expect(
      screen.getByText(AUTH_TEST_ACCOUNTS.EDITOR.email),
    ).toBeInTheDocument()
    expect(refreshRequests).toHaveBeenCalledTimes(1)

    releaseRefresh()
    await screen.findByText('authenticated')
    await waitFor(() => expect(privateQuery).toHaveBeenCalledTimes(1))

    const after = rendered.queryClient.getQueryData<AuthSession>(
      authKeys.session(),
    )
    expect(after?.user).toEqual(AUTH_TEST_ACCOUNTS.EDITOR.user)
    expect(after?.csrfToken).not.toBe(before?.csrfToken)
    expect(publicQuery).not.toHaveBeenCalled()
    expect(rendered.queryClient.getQueryData(['public'])).toBe('cached-public')
    expect(screen.queryByText('Sessão expirada')).not.toBeInTheDocument()
  })

  it('signs out once, removes private cache, preserves public cache, and shows only safe expiration copy', async () => {
    const rendered = render(
      <EffectsHarness>
        <AuthProbe />
      </EffectsHarness>,
      { auth: 'admin' },
    )
    rendered.queryClient.setQueryDefaults(['private-cache'], {
      meta: { requiresAuth: true },
    })
    rendered.queryClient.setQueryData(['private-cache'], 'sensitive')
    rendered.queryClient.setQueryData(['public-cache'], 'visible')
    revokeMockRefresh()

    act(() => {
      publishAuthenticationRequired('expired-episode')
      publishAuthenticationRequired('duplicate-episode')
    })

    await screen.findByText('anonymous')
    await waitFor(() =>
      expect(screen.getByText('Sessão expirada')).toBeVisible(),
    )
    expect(screen.getByText('Entre novamente para continuar.')).toBeVisible()
    expect(screen.getAllByText('Sessão expirada')).toHaveLength(1)
    expect(
      screen.queryByText(/csrf|token|SESSION_EXPIRED/i),
    ).not.toBeInTheDocument()
    expect(rendered.queryClient.getQueryData(['private-cache'])).toBeUndefined()
    expect(rendered.queryClient.getQueryData(['public-cache'])).toBe('visible')
    expect(
      rendered.queryClient.getQueryData<AuthSession>(authKeys.session())?.user,
    ).toBeNull()
  })

  it('allows a later independent episode and remains single-flight in StrictMode', async () => {
    const refreshRequests = vi.fn()
    server.use(
      http.post('*/auth/refresh', () => {
        refreshRequests()
        return HttpResponse.json(refreshMockSession())
      }),
    )
    render(
      <EffectsHarness>
        <AuthProbe />
      </EffectsHarness>,
      { auth: 'editor', reactStrictMode: true },
    )

    act(() => {
      publishAuthenticationRequired('strict-first')
      publishAuthenticationRequired('strict-duplicate')
    })
    await waitFor(() => expect(refreshRequests).toHaveBeenCalledTimes(1))
    await screen.findByText('authenticated')

    act(() => publishAuthenticationRequired('later-episode'))
    await waitFor(() => expect(refreshRequests).toHaveBeenCalledTimes(2))
    await screen.findByText('authenticated')
  })

  it('never replays the mutation that published the 401', async () => {
    const mutationRequests = vi.fn()
    server.use(
      http.post('*/private-action', () =>
        HttpResponse.json(
          { message: 'Access expired.', code: 'ACCESS_EXPIRED' },
          { status: 401 },
        ),
      ),
    )
    render(
      <EffectsHarness>
        <FailingMutation onRequest={mutationRequests} />
        <AuthProbe />
      </EffectsHarness>,
      { auth: 'editor' },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run private action' }))

    await waitFor(() => expect(mutationRequests).toHaveBeenCalledTimes(1))
    await screen.findByText('authenticated')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mutationRequests).toHaveBeenCalledTimes(1)
  })
})
