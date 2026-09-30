import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNotifications } from '@/lib/notifications'
import { NotificationProvider } from './notification-provider'

function NotificationProbe({ onDismiss }: { onDismiss: () => void }) {
  const { show, dismiss } = useNotifications()
  return (
    <>
      <button
        onClick={() => {
          show({
            id: 'one-occurrence',
            title: 'Falha na operação',
            description: 'Tente novamente.',
            onDismiss,
          })
        }}
      >
        Mostrar
      </button>
      <button onClick={() => dismiss('one-occurrence')}>Dispensar</button>
    </>
  )
}

describe('NotificationProvider', () => {
  it('shows one accessible notice per id and dismisses it once', () => {
    const onDismiss = vi.fn()
    render(
      <NotificationProvider>
        <NotificationProbe onDismiss={onDismiss} />
      </NotificationProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(screen.getByRole('region', { name: 'Notificações' })).toBeVisible()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByText('Tente novamente.')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dispensar notificação: Falha na operação',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
