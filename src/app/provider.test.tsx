import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppProvider } from './provider'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <span data-testid="query-devtools" />,
}))

function QueryClientProbe({
  onClient,
}: {
  onClient: (client: QueryClient) => void
}) {
  onClient(useQueryClient())
  return null
}

describe('AppProvider', () => {
  it('keeps one Query client for a mounted app and enables development tools', () => {
    const clients: QueryClient[] = []
    const onClient = (client: QueryClient) => clients.push(client)
    const first = render(
      <AppProvider>
        <QueryClientProbe onClient={onClient} />
      </AppProvider>,
    )

    const initialClient = clients[clients.length - 1]
    first.rerender(
      <AppProvider>
        <QueryClientProbe onClient={onClient} />
      </AppProvider>,
    )

    expect(clients[clients.length - 1]).toBe(initialClient)
    expect(screen.getByTestId('query-devtools')).toBeInTheDocument()
    first.unmount()

    render(
      <AppProvider>
        <QueryClientProbe onClient={onClient} />
      </AppProvider>,
    )
    expect(clients[clients.length - 1]).not.toBe(initialClient)
  })
})
