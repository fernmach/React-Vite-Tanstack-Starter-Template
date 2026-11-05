import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppProvider } from './provider'
import * as query from '@/lib/react-query'
import { errorReporting } from '@/lib/error-reporting'

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
  it('contains provider initialization failure and rebuilds providers on reset', () => {
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('SECRET provider failure')
    const createClient = vi
      .spyOn(query, 'createQueryClient')
      .mockImplementation(() => {
        throw error
      })
    try {
      render(
        <AppProvider>
          <p>Aplicação pronta</p>
        </AppProvider>,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível exibir a aplicação.',
      )
      expect(document.body).not.toHaveTextContent('SECRET')
      expect(reporter).toHaveBeenCalledTimes(1)
      createClient.mockRestore()
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
      expect(screen.getByText('Aplicação pronta')).toBeVisible()
    } finally {
      createClient.mockRestore()
      consoleError.mockRestore()
      errorReporting.configure({ reporter: undefined, development: false })
    }
  })
  it('keeps one Query client and excludes development tools from test builds', () => {
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
    expect(screen.queryByTestId('query-devtools')).not.toBeInTheDocument()
    first.unmount()

    render(
      <AppProvider>
        <QueryClientProbe onClient={onClient} />
      </AppProvider>,
    )
    expect(clients[clients.length - 1]).not.toBe(initialClient)
  })
})
