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
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining('estado anterior foi restaurado'),
    )
  })
})
