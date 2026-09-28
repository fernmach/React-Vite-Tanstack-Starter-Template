import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { routeTree } from '@/routeTree.gen'
import { render, screen } from '@/test/render'

async function renderRoute(path = '/instrucoes') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  await router.load()

  return { router, ...render(<RouterProvider router={router} />) }
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
  })

  it('provides the reserved create destination with a keyboard-focusable link', async () => {
    await renderRoute()
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
})
