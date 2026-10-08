import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { instructionsUrl } from '@/mocks/instructions-handlers'
import { updateInstruction } from '@/mocks/instructions-store'
import { server } from '@/mocks/server'
import {
  resetAuthenticationRequiredEpisode,
  subscribeAuthenticationRequired,
} from '@/lib/api-events'
import { render, screen, waitFor } from '@/test/render'
import { useInstructions } from '../api/get-instructions'
import type { Instruction } from '../model/instruction'
import { InstructionActiveSwitch } from './instruction-active-switch'

const activeInstruction: Instruction = {
  id: 'instruction-active',
  code: 'ACTIVE-001',
  description: 'Active instruction',
  url: 'https://example.test/active',
  active: true,
  archived: false,
}

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
  it('uses unique switch IDs and associates each visible label', () => {
    render(
      <>
        <InstructionActiveSwitch
          instruction={activeInstruction}
          onAnnounce={vi.fn()}
        />
        <InstructionActiveSwitch
          instruction={activeInstruction}
          onAnnounce={vi.fn()}
        />
      </>,
      { auth: 'editor' },
    )

    const controls = screen.getAllByRole('switch')
    const labels = screen.getAllByText('Ativo')
    expect(controls[0].id).not.toBe(controls[1].id)
    expect(labels[0]).toHaveAttribute('for', controls[0].id)
    expect(labels[1]).toHaveAttribute('for', controls[1].id)
  })

  it('renders read-only states as non-destructive badges', () => {
    render(
      <>
        <InstructionActiveSwitch
          instruction={activeInstruction}
          onAnnounce={vi.fn()}
        />
        <InstructionActiveSwitch
          instruction={{ ...activeInstruction, id: 'inactive', active: false }}
          onAnnounce={vi.fn()}
        />
      </>,
      { auth: 'anonymous' },
    )

    const active = screen.getByLabelText(
      'Estado da instrução ACTIVE-001: Ativo',
    )
    const inactive = screen.getByLabelText(
      'Estado da instrução ACTIVE-001: Inativo',
    )
    expect(active).toHaveTextContent('Ativo')
    expect(active).not.toHaveClass('bg-destructive')
    expect(inactive).toHaveTextContent('Inativo')
    expect(inactive).not.toHaveClass('bg-destructive')
  })

  it('describes a failed refresh after a confirmed active write without rolling back', async () => {
    const user = userEvent.setup()
    render(<Harness onAnnounce={vi.fn()} />, { auth: 'editor' })
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
    const { queryClient } = render(<Harness onAnnounce={vi.fn()} />, {
      auth: 'editor',
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    await user.click(
      await screen.findByRole('switch', { name: 'Desativar instrução 186681' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta instrução não está mais disponível.',
    )
    expect(
      screen.getByRole('button', { name: 'Atualizar lista' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Atualizar lista' }))
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['instructions', 'list'],
    })
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

    render(<Harness onAnnounce={announce} />, { auth: 'editor' })
    const control = await screen.findByRole('switch', {
      name: 'Desativar instrução 186681',
    })
    await user.click(control)

    await waitFor(() => expect(control).not.toBeChecked())
    expect(control).toBeDisabled()
    expect(control.closest('[data-slot="field"]')).toHaveAttribute(
      'data-disabled',
      'true',
    )
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

    render(<Harness onAnnounce={announce} />, { auth: 'editor' })
    const control = await screen.findByRole('switch', {
      name: 'Desativar instrução 186681',
    })
    await user.click(control)
    await waitFor(() => expect(control).not.toBeChecked())

    releaseRequest()
    await waitFor(() => expect(control).toBeChecked())
    expect(screen.getByText('Ativo')).toBeVisible()
    expect(announce).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível alterar a instrução')
    expect(alert).toHaveClass('text-destructive')
    expect(alert.querySelector('p')).toHaveTextContent(
      'Não foi possível alterar a instrução',
    )
  })

  it('keeps authentication feedback neutral while other mutation failures are destructive', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json({ message: 'PRIVATE AUTH' }, { status: 401 }),
      ),
    )

    render(<Harness onAnnounce={vi.fn()} />, { auth: 'editor' })
    await user.click(
      await screen.findByRole('switch', { name: 'Desativar instrução 186681' }),
    )

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('A operação está indisponível.')
    expect(status).not.toHaveClass('text-destructive')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE AUTH')).not.toBeInTheDocument()
    resetAuthenticationRequiredEpisode()
  })

  it('shows distinct forbidden feedback without publishing authentication recovery', async () => {
    const user = userEvent.setup()
    const authenticationRequired = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(authenticationRequired)
    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json(
          { message: 'PRIVATE PERMISSION DETAIL', code: 'FORBIDDEN' },
          { status: 403 },
        ),
      ),
    )

    render(<Harness onAnnounce={vi.fn()} />, { auth: 'editor' })
    await user.click(
      await screen.findByRole('switch', { name: 'Desativar instrução 186681' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para realizar esta operação.',
    )
    expect(
      screen.queryByText('PRIVATE PERMISSION DETAIL'),
    ).not.toBeInTheDocument()
    expect(authenticationRequired).not.toHaveBeenCalled()
    unsubscribe()
    resetAuthenticationRequiredEpisode()
  })
})
