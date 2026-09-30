import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import {
  publishAuthenticationRequired,
  resetAuthenticationRequiredEpisode,
} from '@/lib/api-events'
import { ApiErrorEffects } from './api-error-effects'

afterEach(() => resetAuthenticationRequiredEpisode())

function renderEffects(
  onAuthenticationRequired?: Parameters<
    typeof ApiErrorEffects
  >[0]['onAuthenticationRequired'],
) {
  return render(
    <NotificationProvider>
      <ApiErrorEffects onAuthenticationRequired={onAuthenticationRequired} />
    </NotificationProvider>,
  )
}

describe('ApiErrorEffects', () => {
  it('replays a pending episode, coalesces concurrent 401s, and resets on dismissal', () => {
    publishAuthenticationRequired('initial')
    const onAuthenticationRequired = vi.fn()
    const originalPath = window.location.pathname
    renderEffects(onAuthenticationRequired)

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByText('Autenticação necessária')).toBeVisible()
    act(() => publishAuthenticationRequired('concurrent'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(onAuthenticationRequired).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe(originalPath)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dispensar notificação: Autenticação necessária',
      }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => publishAuthenticationRequired('retry'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(onAuthenticationRequired).toHaveBeenCalledTimes(2)
  })

  it('allows a future host action to complete recovery without navigation', () => {
    const onAuthenticationRequired = vi.fn()
    renderEffects(onAuthenticationRequired)
    act(() => publishAuthenticationRequired('first'))
    const completeRecovery = onAuthenticationRequired.mock
      .calls[0][1] as () => void
    act(() => completeRecovery())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    act(() => publishAuthenticationRequired('second'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(onAuthenticationRequired).toHaveBeenCalledTimes(2)
  })
})
