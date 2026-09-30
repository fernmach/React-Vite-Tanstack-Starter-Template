import { StrictMode } from 'react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorReporting } from '@/lib/error-reporting'
import { Route } from './__root'

const reporter = vi.fn()
beforeEach(() => {
  reporter.mockClear()
  errorReporting.configure({ reporter })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  errorReporting.configure({ reporter: undefined, development: false })
  vi.restoreAllMocks()
})

describe('configured root route error fallback', () => {
  it.each(['loader', 'render'] as const)(
    'contains %s failures and reloads the route on explicit retry',
    async (failure) => {
      const user = userEvent.setup()
      let broken = true
      const error = new Error('SECRET route diagnostic')
      const loader = vi.fn(() => {
        if (broken && failure === 'loader') throw error
      })
      const root = createRootRoute({
        component: Outlet,
        errorComponent: Route.options.errorComponent,
      })
      const page = createRoute({
        getParentRoute: () => root,
        path: '/',
        loader,
        component: () => {
          if (broken && failure === 'render') throw error
          return <p>Página recuperada</p>
        },
      })
      const router = createRouter({
        routeTree: root.addChildren([page]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })
      const view = render(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível exibir esta página.',
      )
      expect(document.body).not.toHaveTextContent('SECRET')
      await waitFor(() =>
        expect(reporter).toHaveBeenCalledExactlyOnceWith({
          source: 'route',
          category: 'runtime',
        }),
      )
      view.rerender(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      )
      expect(reporter).toHaveBeenCalledTimes(1)
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
      expect(await screen.findByRole('alert')).toBeVisible()
      await waitFor(() => expect(reporter).toHaveBeenCalledTimes(2))
      broken = false
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
      expect(await screen.findByText('Página recuperada')).toBeVisible()
      expect(loader).toHaveBeenCalledTimes(3)
    },
  )

  it('keeps expected route-not-found separate from error reports', async () => {
    const root = createRootRoute({
      component: Outlet,
      errorComponent: Route.options.errorComponent,
      notFoundComponent: () => <p>Página não encontrada</p>,
    })
    const page = createRoute({
      getParentRoute: () => root,
      path: '/',
      loader: () => {
        throw notFound()
      },
    })
    const router = createRouter({
      routeTree: root.addChildren([page]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    await router.load()
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Página não encontrada')).toBeVisible()
    expect(reporter).not.toHaveBeenCalled()
  })
})
