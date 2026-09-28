import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { render, screen, within } from '@/test/render'
import { InstructionsResults } from './instructions-results'
import type { InstructionPage } from '../model/instruction'

const result: InstructionPage = {
  items: [
    {
      id: 'stable-1',
      code: 'MPV-001',
      description: 'Montagem base',
      url: 'https://example.test/mpv-001',
      active: true,
      archived: false,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  first: 1,
  last: 1,
  totalPages: 1,
}

describe('InstructionsResults', () => {
  it('renderiza tabela semântica e ações identificadas por linha', () => {
    render(
      <InstructionsResults
        loading={false}
        error={null}
        result={result}
        onRetry={vi.fn()}
      />,
    )
    const table = screen.getByRole('table')
    expect(
      within(table).getByRole('columnheader', { name: 'Código de MPV' }),
    ).toBeVisible()
    expect(
      within(table).getByRole('link', { name: 'Editar instrução MPV-001' }),
    ).toHaveAttribute('href', '/instrucoes/stable-1/editar')
    expect(
      within(table).getByRole('switch', {
        name: 'Desativar instrução MPV-001',
      }),
    ).toBeChecked()
  })

  it.each([
    {
      props: { loading: true, error: null, result: null },
      text: 'Carregando instruções…',
    },
    {
      props: {
        loading: false,
        error: null,
        result: { ...result, items: [], total: 0, first: 0, last: 0 },
      },
      text: 'Nenhuma instrução encontrada.',
    },
    {
      props: {
        loading: false,
        error: new ApiError({
          kind: 'network',
          message: 'Private transport detail',
          cause: new Error('socket detail'),
        }),
        result: null,
      },
      text: 'Você está offline.',
    },
    {
      props: {
        loading: false,
        error: new ApiError({
          kind: 'unknown',
          message: 'Private internal detail',
          cause: new Error('internal detail'),
        }),
        result: null,
      },
      text: 'Não foi possível carregar as instruções.',
    },
  ])('distingue o estado: $text', ({ props, text }) => {
    render(<InstructionsResults {...props} onRetry={vi.fn()} />)
    expect(screen.getByText(text)).toBeVisible()
    expect(
      screen.queryByText(/Private|socket|internal/),
    ).not.toBeInTheDocument()
  })

  it('shows a validated HTTP message without exposing transport metadata', () => {
    render(
      <InstructionsResults
        loading={false}
        error={
          new ApiError({
            kind: 'http',
            message: 'Serviço temporariamente indisponível.',
            status: 503,
            code: 'PRIVATE_CODE',
            cause: new Error('private cause'),
          })
        }
        result={null}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Serviço temporariamente indisponível.'),
    ).toBeVisible()
    expect(
      screen.queryByText(/PRIVATE_CODE|private cause/),
    ).not.toBeInTheDocument()
  })
})
