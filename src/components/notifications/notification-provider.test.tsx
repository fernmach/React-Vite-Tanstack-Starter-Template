import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { useNotifications } from '@/lib/notifications'
import { NotificationProvider } from './notification-provider'

afterEach(() => {
  act(() => toast.dismiss())
})

function visibleToasts() {
  return document.querySelectorAll<HTMLElement>('[data-sonner-toast]')
}

function NotificationProbe({
  onDismiss,
  onShow,
}: {
  onDismiss: () => void
  onShow: (added: boolean) => void
}) {
  const { show, dismiss } = useNotifications()
  return (
    <>
      <button
        onClick={() => {
          onShow(
            show({
              id: 'one-occurrence',
              title: 'Falha na operação',
              description: 'Tente novamente.',
              tone: 'error',
              onDismiss,
            }),
          )
        }}
      >
        Mostrar erro
      </button>
      <button
        onClick={() =>
          show({
            id: 'information',
            title: 'Operação concluída',
            tone: 'info',
          })
        }
      >
        Mostrar informação
      </button>
      <button onClick={() => dismiss('one-occurrence')}>Dispensar erro</button>
    </>
  )
}

describe('NotificationProvider', () => {
  it('shows one persistent error per id and dismisses each occurrence once', async () => {
    const onDismiss = vi.fn()
    const onShow = vi.fn()
    render(
      <NotificationProvider>
        <NotificationProbe onDismiss={onDismiss} onShow={onShow} />
        <Toaster position="bottom-right" closeButton richColors />
      </NotificationProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar erro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar erro' }))
    await waitFor(() => expect(visibleToasts()).toHaveLength(1))
    expect(onShow.mock.calls.map(([added]) => added)).toEqual([true, false])
    const firstToast = visibleToasts()[0]
    expect(firstToast).toHaveAttribute('data-type', 'error')
    expect(within(firstToast).getByText('Tente novamente.')).toBeVisible()

    fireEvent.click(
      within(firstToast).getByRole('button', { name: /close toast/i }),
    )
    await waitFor(() => expect(visibleToasts()).toHaveLength(0))
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar erro' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar erro' }))
    await waitFor(() => expect(visibleToasts()).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar erro' }))
    await waitFor(() => expect(visibleToasts()).toHaveLength(0))
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('maps informational notifications to the Sonner info variant', async () => {
    render(
      <NotificationProvider>
        <NotificationProbe onDismiss={vi.fn()} onShow={vi.fn()} />
        <Toaster position="bottom-right" closeButton richColors />
      </NotificationProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar informação' }))
    await waitFor(() => expect(visibleToasts()).toHaveLength(1))
    expect(visibleToasts()[0]).toHaveAttribute('data-type', 'info')
  })
})
