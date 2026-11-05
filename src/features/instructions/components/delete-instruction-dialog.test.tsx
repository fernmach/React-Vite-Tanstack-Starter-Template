import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { instructionsUrl } from '@/mocks/instructions-handlers'
import { server } from '@/mocks/server'
import { render, screen, waitFor } from '@/test/render'
import { useInstructions } from '../api/get-instructions'
import { DeleteInstructionDialog } from './delete-instruction-dialog'

function Harness({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const query = useInstructions({ input: { term: '186682' } })
  const instruction = query.data?.items[0]

  if (!instruction) return <p>Instrução removida</p>
  return (
    <DeleteInstructionDialog
      instruction={instruction}
      onAnnounce={onAnnounce}
    />
  )
}

describe('DeleteInstructionDialog', () => {
  it('closes after a confirmed archive even when refresh fails and reports the accurate outcome', async () => {
    const user = userEvent.setup()
    const announce = vi.fn()
    render(<Harness onAnnounce={announce} />, { auth: 'admin' })
    await user.click(
      await screen.findByRole('button', { name: 'Excluir instrução 186682' }),
    )
    server.use(
      http.get(instructionsUrl, () =>
        HttpResponse.json({ message: 'PRIVATE REFRESH' }, { status: 503 }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Arquivar instrução' }))
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        expect.stringContaining(
          'A instrução foi arquivada, mas a lista não pôde ser atualizada.',
        ),
        true,
      ),
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(announce).not.toHaveBeenCalledWith(
      expect.stringContaining('Não foi possível arquivar'),
    )
  })

  it('keeps a missing-record failure in the dialog with list recovery', async () => {
    const user = userEvent.setup()
    render(<Harness onAnnounce={vi.fn()} />, { auth: 'admin' })
    await user.click(
      await screen.findByRole('button', { name: 'Excluir instrução 186682' }),
    )
    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json(
          { message: 'PRIVATE', code: 'INSTRUCTION_NOT_FOUND' },
          { status: 404 },
        ),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Arquivar instrução' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Esta instrução não está mais disponível.')
    expect(alert).toHaveClass('text-destructive')
    expect(alert.querySelector('p')).toHaveTextContent(
      'Esta instrução não está mais disponível.',
    )
    expect(screen.getByRole('alertdialog')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Atualizar lista' }),
    ).toBeVisible()
  })

  it('identifies the record and returns focus when cancellation closes it', async () => {
    const user = userEvent.setup()
    render(<Harness onAnnounce={vi.fn()} />, { auth: 'admin' })
    const trigger = await screen.findByRole('button', {
      name: 'Excluir instrução 186682',
    })
    expect(trigger.querySelector('svg')).toHaveAttribute(
      'data-icon',
      'inline-start',
    )

    await user.click(trigger)
    expect(screen.getByRole('alertdialog')).toBeVisible()
    expect(screen.getByText('Arquivar instrução 186682?')).toBeVisible()
    expect(screen.getByText(/Inspeção final de acabamento/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
  })

  it('closes after archive refetch removes the record and announces success', async () => {
    const user = userEvent.setup()
    const announce = vi.fn()
    render(<Harness onAnnounce={announce} />, { auth: 'admin' })

    await user.click(
      await screen.findByRole('button', {
        name: 'Excluir instrução 186682',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Arquivar instrução' }))

    expect(await screen.findByText('Instrução removida')).toBeVisible()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(announce).toHaveBeenCalledWith(
      'Instrução 186682 arquivada com sucesso.',
    )
  })

  it('stays open during a request and remains enabled for recovery after failure', async () => {
    const user = userEvent.setup()
    const announce = vi.fn()
    let releaseRequest!: () => void
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    render(<Harness onAnnounce={announce} />, { auth: 'admin' })
    await user.click(
      await screen.findByRole('button', {
        name: 'Excluir instrução 186682',
      }),
    )
    server.use(
      http.patch(`${instructionsUrl}/*`, async () => {
        await requestGate
        return HttpResponse.json({ message: 'Unavailable' }, { status: 503 })
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Arquivar instrução' }))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Arquivando…' })).toBeDisabled()

    releaseRequest()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível arquivar a instrução. Tente novamente.',
    )
    expect(announce).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Arquivar instrução' }),
    ).toBeEnabled()
  })

  it('keeps authentication feedback neutral inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness onAnnounce={vi.fn()} />, { auth: 'admin' })
    await user.click(
      await screen.findByRole('button', { name: 'Excluir instrução 186682' }),
    )
    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json({ message: 'PRIVATE AUTH' }, { status: 401 }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Arquivar instrução' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('A operação está indisponível.')
    expect(status).not.toHaveClass('text-destructive')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE AUTH')).not.toBeInTheDocument()
  })
})
