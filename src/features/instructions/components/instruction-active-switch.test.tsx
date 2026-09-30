import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { instructionsUrl } from '@/mocks/instructions-handlers'
import { updateInstruction } from '@/mocks/instructions-store'
import { server } from '@/mocks/server'
import { render, screen, waitFor } from '@/test/render'
import { useInstructions } from '../api/get-instructions'
import { InstructionActiveSwitch } from './instruction-active-switch'

function Harness({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const query = useInstructions({ input: { term: '186681' } })
  const instruction = query.data?.items[0]

  if (!instruction) return <p>Carregando</p>
  return (
    <InstructionActiveSwitch
      instruction={instruction}
      onAnnounce={onAnnounce}
    />
  )
}

describe('InstructionActiveSwitch', () => {
  it('describes a failed refresh after a confirmed active write without rolling back', async () => {
    const user = userEvent.setup()
    render(<Harness onAnnounce={vi.fn()} />)
    const control = await screen.findByRole('switch', {
      name: 'Desativar instrução 186681',
    })
    server.use(
      http.get(instructionsUrl, () =>
        HttpResponse.json({ message: 'PRIVATE REFRESH' }, { status: 503 }),
      ),
    )
    await user.click(control)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A alteração foi salva, mas a lista não pôde ser atualizada.',
    )
    expect(control).not.toBeChecked()
    expect(screen.queryByText('PRIVATE REFRESH')).not.toBeInTheDocument()
  })

  it('shows the known missing-record copy and a list refresh action', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json(
          { message: 'PRIVATE', code: 'INSTRUCTION_NOT_FOUND' },
          { status: 404 },
        ),
      ),
    )
    render(<Harness onAnnounce={vi.fn()} />)
    await user.click(
      await screen.findByRole('switch', { name: 'Desativar instrução 186681' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta instrução não está mais disponível.',
    )
    expect(
      screen.getByRole('button', { name: 'Atualizar lista' }),
    ).toBeVisible()
    expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument()
  })

  it('optimistically updates, disables duplicate input, and announces success', async () => {
    const user = userEvent.setup()
    const announce = vi.fn()
    let releaseRequest!: () => void
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    let patchCount = 0
    server.use(
      http.patch(`${instructionsUrl}/*`, async () => {
        patchCount += 1
        await requestGate
        return HttpResponse.json(
          updateInstruction('instruction-186681', { active: false }),
        )
      }),
    )

    render(<Harness onAnnounce={announce} />)
    const control = await screen.findByRole('switch', {
      name: 'Desativar instrução 186681',
    })
    await user.click(control)

    await waitFor(() => expect(control).not.toBeChecked())
    expect(control).toBeDisabled()
    expect(screen.getByText('Salvando…')).toBeVisible()
    await user.click(control)
    expect(patchCount).toBe(1)

    releaseRequest()
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        'Instrução 186681 marcada como inativa.',
      ),
    )
    expect(await screen.findByText('Inativo')).toBeVisible()
  })

  it('rolls back a failed optimistic update and announces restoration', async () => {
    const user = userEvent.setup()
    const announce = vi.fn()
    let releaseRequest!: () => void
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    server.use(
      http.patch(`${instructionsUrl}/*`, async () => {
        await requestGate
        return HttpResponse.json({ message: 'Unavailable' }, { status: 503 })
      }),
    )

    render(<Harness onAnnounce={announce} />)
    const control = await screen.findByRole('switch', {
      name: 'Desativar instrução 186681',
    })
    await user.click(control)
    await waitFor(() => expect(control).not.toBeChecked())

    releaseRequest()
    await waitFor(() => expect(control).toBeChecked())
    expect(screen.getByText('Ativo')).toBeVisible()
    expect(announce).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível alterar a instrução',
    )
  })
})
