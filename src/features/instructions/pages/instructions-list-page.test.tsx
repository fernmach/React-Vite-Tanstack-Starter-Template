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
    expect(await screen.findByText('Você está offline.')).toBeVisible()
    expect(
      screen.getByText(
        'Sem conexão. Verifique sua internet e tente novamente.',
      ),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findAllByText('MPV-001')).not.toHaveLength(0)
    expect(attempts).toBe(2)
  })
})
