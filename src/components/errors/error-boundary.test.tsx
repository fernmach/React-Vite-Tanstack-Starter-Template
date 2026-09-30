import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorReporting } from '@/lib/error-reporting'
import {
  ApplicationErrorBoundary,
  SectionErrorBoundary,
} from './error-boundary'

const reporter = vi.fn()
beforeEach(() => {
  reporter.mockClear()
  errorReporting.configure({ reporter })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  errorReporting.configure({ reporter: undefined, development: false })
  vi.restoreAllMocks()
})

function Broken({ error }: { error: unknown }): never {
  throw error
}

describe('render boundaries', () => {
  it('contains root failures, hides diagnostics, and resets only on user action', async () => {
    const user = userEvent.setup()
    const error = new Error('SECRET stack/config/body')
    const view = render(
      <StrictMode>
        <ApplicationErrorBoundary>
          <Broken error={error} />
        </ApplicationErrorBoundary>
      </StrictMode>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível exibir a aplicação.',
    )
    expect(document.body).not.toHaveTextContent('SECRET')
    expect(
      screen.getByRole('link', { name: 'Ir para o início' }),
    ).toHaveAttribute('href', '/')
    expect(
      screen.getByRole('button', { name: 'Recarregar aplicação' }),
    ).toBeVisible()
    expect(reporter).toHaveBeenCalledExactlyOnceWith({
      source: 'application',
      category: 'runtime',
    })
    view.rerender(
      <StrictMode>
        <ApplicationErrorBoundary>
          <p>Recuperado</p>
        </ApplicationErrorBoundary>
      </StrictMode>,
    )
    expect(screen.queryByText('Recuperado')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(screen.getByText('Recuperado')).toBeVisible()
  })

  it('contains a section without losing sibling state or escalating to the app boundary', async () => {
    const user = userEvent.setup()
    render(
      <ApplicationErrorBoundary>
        <label>
          Rascunho
          <input defaultValue="preservado" />
        </label>
        <SectionErrorBoundary>
          <Broken error={new Error('private')} />
        </SectionErrorBoundary>
      </ApplicationErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível exibir esta seção.',
    )
    await user.type(screen.getByRole('textbox'), ' atualizado')
    expect(screen.getByRole('textbox')).toHaveValue('preservado atualizado')
    expect(reporter).toHaveBeenCalledExactlyOnceWith({
      source: 'section',
      category: 'runtime',
    })
  })

  it('does not report a cache-owned error again when it reaches a boundary', () => {
    const error = new Error('private')
    errorReporting.reportExecution(error, { source: 'query' })
    render(
      <ApplicationErrorBoundary>
        <Broken error={error} />
      </ApplicationErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeVisible()
    expect(reporter).toHaveBeenCalledTimes(1)
  })

  it('keeps a persistent failure contained after manual reset without a retry loop', async () => {
    const user = userEvent.setup()
    const error = new Error('private')
    render(
      <ApplicationErrorBoundary>
        <Broken error={error} />
      </ApplicationErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(screen.getByRole('alert')).toBeVisible()
    expect(reporter).toHaveBeenCalledTimes(2)
  })
})
