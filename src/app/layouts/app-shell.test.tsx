import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { HttpResponse, http } from 'msw'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { NotificationProvider } from '@/components/notifications/notification-provider'
import { routeTree } from '@/routeTree.gen'
import { authKeys } from '@/lib/auth/api'
import { AuthProvider } from '@/lib/auth/provider'
import { createQueryClient } from '@/lib/react-query'
import { AUTH_TEST_ACCOUNTS, logoutMockSession } from '@/mocks/auth-store'
import { server } from '@/mocks/server'
import { render, screen } from '@/test/render'

async function renderRoute(
  path = '/instrucoes',
  auth: 'anonymous' | 'editor' | 'admin' = 'anonymous',
) {
  const queryClient = createQueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  await router.load()

  return {
    router,
    ...render(
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>,
      { queryClient, auth },
    ),
  }
}

describe('application shell', () => {
  it('shows the public product identity and active instructions navigation', async () => {
    await renderRoute()
    expect(
      await screen.findByRole('heading', {
        name: 'Instruções de Montagem de MPV',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Homologação')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).toHaveTextContent('Instruções')
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login',
    )
  }, 15_000)

  it('provides the reserved create destination with a keyboard-focusable link', async () => {
    await renderRoute('/instrucoes', 'editor')
    const createLink = await screen.findByRole('link', {
      name: 'Nova Instrução',
    })
    expect(createLink).toHaveAttribute('href', '/instrucoes/nova')
    createLink.focus()
    expect(createLink).toHaveFocus()
  })

  it('redirects the root route to the instructions page', async () => {
    const { router } = await renderRoute('/')

    expect(
      await screen.findByRole('heading', {
        name: 'Instruções de Montagem de MPV',
      }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/instrucoes')
  })

  it('shows loading and recovering session status without an account action', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('*/auth/session', async () => {
        await pending
        return HttpResponse.json({ user: null, csrfToken: 'shell-csrf' })
      }),
    )
    const queryClient = createQueryClient()
    const router = createRouter({
      routeTree,
      context: { queryClient },
      history: createMemoryHistory({ initialEntries: ['/instrucoes'] }),
    })
    await router.load()
    render(
      <AuthProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </AuthProvider>,
      { queryClient },
    )

    expect(screen.getByText('Verificando sessão…')).toHaveAttribute(
      'role',
      'status',
    )
    expect(
      screen.queryByRole('link', { name: 'Entrar' }),
    ).not.toBeInTheDocument()
    release()
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeVisible()

    queryClient.setQueryData(authKeys.session(), {
      user: AUTH_TEST_ACCOUNTS.EDITOR.user,
      csrfToken: 'shell-csrf',
    })
    let releaseRecovery!: () => void
    const recoveryPending = new Promise<void>((resolve) => {
      releaseRecovery = resolve
    })
    server.use(
      http.get('*/auth/session', async () => {
        await recoveryPending
        return HttpResponse.json({
          user: AUTH_TEST_ACCOUNTS.EDITOR.user,
          csrfToken: 'recovered-csrf',
        })
      }),
    )
    void queryClient.refetchQueries({ queryKey: authKeys.session() })
    expect(await screen.findByText('Atualizando sessão…')).toHaveAttribute(
      'role',
      'status',
    )
    expect(
      screen.queryByRole('button', { name: 'Sair' }),
    ).not.toBeInTheDocument()
    releaseRecovery()
    expect(
      await screen.findByText(AUTH_TEST_ACCOUNTS.EDITOR.user.name),
    ).toBeVisible()
  }, 15_000)

  it('shows the validated user and accessible logout progress before becoming anonymous', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('*/auth/logout', async () => {
        await pending
        logoutMockSession()
        return HttpResponse.json({ success: true })
      }),
    )
    const user = userEvent.setup()
    await renderRoute('/instrucoes', 'editor')

    expect(screen.getByText(AUTH_TEST_ACCOUNTS.EDITOR.user.name)).toBeVisible()
    const logout = user.click(screen.getByRole('button', { name: 'Sair' }))

    expect(
      await screen.findByRole('button', { name: 'Saindo…' }),
    ).toBeDisabled()
    expect(screen.getByText('Encerrando sessão…')).toHaveAttribute(
      'role',
      'status',
    )
    release()
    await logout
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeVisible()
  }, 15_000)

  it('cleans up locally and announces safe feedback when logout transport fails', async () => {
    server.use(http.post('*/auth/logout', () => HttpResponse.error()))
    const user = userEvent.setup()
    await renderRoute('/instrucoes', 'admin')

    await user.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível encerrar a sessão no servidor. Você saiu neste dispositivo.',
    )
  })
})
