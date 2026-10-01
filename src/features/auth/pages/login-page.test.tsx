import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { authKeys } from '@/lib/auth/api'
import { createQueryClient } from '@/lib/react-query'
import {
  AUTH_TEST_ACCOUNTS,
  authenticateMockAs,
  currentMockCsrfToken,
} from '@/mocks/auth-store'
import { routeTree } from '@/routeTree.gen'
import { render, screen, waitFor } from '@/test/render'

async function renderLogin(path: string) {
  const queryClient = createQueryClient()
  queryClient.setQueryData(authKeys.session(), {
    user: null,
    csrfToken: currentMockCsrfToken(),
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  const rendered = render(
    <NotificationProvider>
      <RouterProvider router={router} />
    </NotificationProvider>,
    { queryClient, auth: 'anonymous' },
  )
  return { router, ...rendered }
}

async function loginAsEditor() {
  const user = userEvent.setup()
  await user.type(
    screen.getByLabelText('E-mail'),
    AUTH_TEST_ACCOUNTS.EDITOR.email,
  )
  await user.type(
    screen.getByLabelText('Senha'),
    AUTH_TEST_ACCOUNTS.EDITOR.password,
  )
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('login page routing', () => {
  it('logs in, updates the canonical cache, and restores query and hash', async () => {
    const { router, queryClient } = await renderLogin(
      '/login?redirect=%2Finstrucoes%3Fpagina%3D2%23resultado-4',
    )

    await loginAsEditor()

    await waitFor(() =>
      expect(router.state.location.href).toBe(
        '/instrucoes?pagina=2#resultado-4',
      ),
    )
    expect(queryClient.getQueryData(authKeys.session())).toMatchObject({
      user: AUTH_TEST_ACCOUNTS.EDITOR.user,
    })
  }, 15_000)

  it('falls back safely when route search contains a rejected redirect', async () => {
    const { router } = await renderLogin(
      `/login?redirect=${encodeURIComponent('//evil.example/steal')}`,
    )
    await loginAsEditor()
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/instrucoes'),
    )
  }, 15_000)

  it('redirects an already-authenticated visitor away from login', async () => {
    const queryClient = createQueryClient()
    const session = authenticateMockAs('EDITOR')
    queryClient.setQueryData(authKeys.session(), session)
    const router = createRouter({
      routeTree,
      context: { queryClient },
      history: createMemoryHistory({
        initialEntries: [
          '/login?redirect=%2Finstrucoes%3Fbusca%3Dazul%23resultado',
        ],
      }),
    })

    await router.load()

    expect(router.state.location.href).toBe('/instrucoes?busca=azul#resultado')
  })
})
