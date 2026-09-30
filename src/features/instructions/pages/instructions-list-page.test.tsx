import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { instructionsUrl } from '@/mocks/instructions-handlers'
import { server } from '@/mocks/server'
import { render, screen, waitFor } from '@/test/render'
import type { InstructionPage } from '../model/instruction'
import { InstructionsListPage } from './instructions-list-page'

const item = {
  id: 'stable-1',
  code: 'MPV-001',
  description: 'Montagem base',
  url: 'https://example.test/mpv-001',
  active: true,
  archived: false,
}

function page(pageNumber = 1): InstructionPage {
  return {
    items: [item],
    page: pageNumber,
    pageSize: 20,
    total: 45,
    first: pageNumber === 1 ? 1 : 21,
    last: pageNumber === 1 ? 20 : 40,
    totalPages: 3,
  }
}

describe('InstructionsListPage', () => {
  it('keeps cancellation silent', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get(instructionsUrl, async () => {
        await gate
        return HttpResponse.json(page())
      }),
    )
    const { queryClient } = render(<InstructionsListPage />)
    await queryClient.cancelQueries()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/Não foi possível/)).not.toBeInTheDocument()
    release()
  })

  it('retains valid results when a background refresh fails and offers recovery', async () => {
    const user = userEvent.setup()
    let fail = false
    server.use(
      http.get(instructionsUrl, () =>
        fail
          ? HttpResponse.json(
              { message: 'PRIVATE BACKEND TEXT' },
              { status: 503 },
            )
          : HttpResponse.json(page()),
      ),
    )
    const { queryClient } = render(<InstructionsListPage />)
    expect(await screen.findAllByText('MPV-001')).not.toHaveLength(0)
    fail = true
    await queryClient.invalidateQueries()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Os resultados anteriores continuam disponíveis.',
    )
    expect(screen.getAllByText('MPV-001')).not.toHaveLength(0)
    expect(screen.queryByText('PRIVATE BACKEND TEXT')).not.toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Atualizar lista' }))
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })

  it('does not show the old page as a successful new result after a failed page request', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(instructionsUrl, ({ request }) => {
        const requested = Number(new URL(request.url).searchParams.get('page'))
        return requested === 2
          ? HttpResponse.json(
              { message: 'PRIVATE PAGE', code: 'INVALID_PAGINATION' },
              { status: 400 },
            )
          : HttpResponse.json(page())
      }),
    )
    render(<InstructionsListPage />)
    expect(await screen.findAllByText('MPV-001')).not.toHaveLength(0)
    await user.click(screen.getByRole('link', { name: 'Próxima página' }))
    expect(
      await screen.findByText('Não foi possível carregar esta página.'),
    ).toBeVisible()
    expect(screen.queryByText('MPV-001')).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE PAGE')).not.toBeInTheDocument()
  })

  it('shows safe copy for an invalid response schema', async () => {
    server.use(
      http.get(instructionsUrl, () =>
        HttpResponse.json({ items: ['PRIVATE INVALID DATA'] }),
      ),
    )
    render(<InstructionsListPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Os dados recebidos não puderam ser exibidos com segurança.',
    )
    expect(screen.queryByText('PRIVATE INVALID DATA')).not.toBeInTheDocument()
  })

  it('keeps 401 query feedback neutral without a local authentication alert', async () => {
    server.use(
      http.get(instructionsUrl, () =>
        HttpResponse.json({ message: 'PRIVATE AUTH' }, { status: 401 }),
      ),
    )
    render(<InstructionsListPage />)
    expect(
      await screen.findByText('A lista de instruções está indisponível.'),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE AUTH')).not.toBeInTheDocument()
  })

  it('shows initial loading, renders results, and retains search across pagination', async () => {
    const user = userEvent.setup()
    const requests: URL[] = []
    let releaseInitial!: () => void
    const initialGate = new Promise<void>((resolve) => {
      releaseInitial = resolve
    })
    let requestCount = 0

    server.use(
      http.get(instructionsUrl, async ({ request }) => {
        requests.push(new URL(request.url))
        requestCount += 1
        if (requestCount === 1) await initialGate
        const requestedPage = Number(
          new URL(request.url).searchParams.get('page'),
        )
        return HttpResponse.json(page(requestedPage))
      }),
    )

    render(<InstructionsListPage />)
    expect(screen.getByText('Carregando instruções…')).toBeVisible()

    releaseInitial()
    expect(await screen.findAllByText('MPV-001')).not.toHaveLength(0)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent(
      '45 resultados encontrados. Página 1 de 3.',
    )

    const search = screen.getByRole('searchbox', {
      name: 'Pesquisar instruções',
    })
    await user.type(search, ' montagem {Enter}')
    await waitFor(() => {
      const latest = requests[requests.length - 1]
      expect(latest?.searchParams.get('term')).toBe('montagem')
      expect(latest?.searchParams.get('page')).toBe('1')
      expect(latest?.searchParams.get('pageSize')).toBe('20')
    })

    await user.click(screen.getByRole('link', { name: 'Próxima página' }))
    await waitFor(() => {
      const latest = requests[requests.length - 1]
      expect(latest?.searchParams.get('term')).toBe('montagem')
      expect(latest?.searchParams.get('page')).toBe('2')
    })
    expect(screen.getAllByText('MPV-001')).not.toHaveLength(0)
  })

  it('presents a safe network error and retries the same query successfully', async () => {
    const user = userEvent.setup()
    let attempts = 0
    server.use(
      http.get(instructionsUrl, () => {
        attempts += 1
        return attempts === 1 ? HttpResponse.error() : HttpResponse.json(page())
      }),
    )

    render(<InstructionsListPage />)
    expect(
      await screen.findByText(
        'Não foi possível conectar ao serviço. Tente novamente.',
      ),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findAllByText('MPV-001')).not.toHaveLength(0)
    expect(attempts).toBe(2)
  })
})
