import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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
      { auth: 'editor' },
    )
    const table = screen.getByRole('table')
    expect(
      within(table).getByRole('columnheader', { name: 'Código de MPV' }),
    ).toBeVisible()
    const editAction = within(table).getByRole('link', {
      name: 'Editar instrução MPV-001',
    })
    expect(editAction).toHaveAttribute('href', '/instrucoes/stable-1/editar')
    expect(editAction.querySelector('svg')).toHaveAttribute(
      'data-icon',
      'inline-start',
    )
    expect(
      within(table).getByRole('switch', {
        name: 'Desativar instrução MPV-001',
      }),
    ).toBeChecked()
  })

  it('renders an accessible loading status with visual skeletons', () => {
    const { container } = render(
      <InstructionsResults
        loading
        error={null}
        result={null}
        onRetry={vi.fn()}
      />,
      { auth: 'anonymous' },
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Carregando instruções…',
    )
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3)
  })

  it('uses the Empty composition for no results without adding an action', () => {
    const { container } = render(
      <InstructionsResults
        loading={false}
        error={null}
        result={{ ...result, items: [], total: 0, first: 0, last: 0 }}
        onRetry={vi.fn()}
      />,
      { auth: 'anonymous' },
    )

    expect(container.querySelector('[data-slot="empty"]')).toBeVisible()
    expect(container.querySelector('[data-slot="empty-header"]')).toBeVisible()
    expect(
      container.querySelector('[data-slot="empty-title"]'),
    ).toHaveTextContent('Nenhuma instrução encontrada.')
    expect(
      container.querySelector('[data-slot="empty-description"]'),
    ).toHaveTextContent('Revise o termo pesquisado ou limpe o filtro.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
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
      text: 'Não foi possível conectar ao serviço. Tente novamente.',
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
      text: 'Não foi possível carregar as instruções. Tente novamente.',
    },
  ])('distingue o estado: $text', ({ props, text }) => {
    const { container } = render(
      <InstructionsResults {...props} onRetry={vi.fn()} />,
      {
        auth: 'anonymous',
      },
    )
    expect(screen.getByText(text)).toBeVisible()
    expect(screen.getByRole('alert')).toHaveClass('text-destructive')
    expect(container.querySelector('h5')).toHaveTextContent(text)
    expect(
      screen.queryByText(/Private|socket|internal/),
    ).not.toBeInTheDocument()
  })

  it('keeps the retry callback on the Alert recovery action', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <InstructionsResults
        loading={false}
        error={
          new ApiError({
            kind: 'network',
            message: 'Private transport detail',
          })
        }
        result={null}
        onRetry={onRetry}
      />,
      { auth: 'anonymous' },
    )

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('never renders a validated backend message or transport metadata', () => {
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
      { auth: 'anonymous' },
    )

    expect(
      screen.getByText(
        'Não foi possível carregar as instruções. Tente novamente.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByText(
        /Serviço temporariamente indisponível|PRIVATE_CODE|private cause/,
      ),
    ).not.toBeInTheDocument()
  })

  it('keeps a 401 query failure inline without repeating the authentication alert', () => {
    render(
      <InstructionsResults
        loading={false}
        error={
          new ApiError({
            kind: 'http',
            status: 401,
            message: 'Private session details',
          })
        }
        result={null}
        onRetry={vi.fn()}
      />,
      { auth: 'anonymous' },
    )

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('A lista de instruções está indisponível.')
    expect(status).not.toHaveClass('text-destructive')
    expect(status.querySelector('h5')).toHaveTextContent(
      'A lista de instruções está indisponível.',
    )
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Private session details'),
    ).not.toBeInTheDocument()
  })
})
