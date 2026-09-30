import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { Toaster } from '@/components/ui/sonner'
import {
  publishAuthenticationRequired,
  resetAuthenticationRequiredEpisode,
} from '@/lib/api-events'
import { ApiErrorEffects } from './api-error-effects'

afterEach(() => {
  resetAuthenticationRequiredEpisode()
  act(() => toast.dismiss())
})

function visibleToasts() {
  return document.querySelectorAll<HTMLElement>('[data-sonner-toast]')
}

function renderEffects(
  onAuthenticationRequired?: Parameters<
    typeof ApiErrorEffects
  >[0]['onAuthenticationRequired'],
) {
  return render(
    <NotificationProvider>
      <ApiErrorEffects onAuthenticationRequired={onAuthenticationRequired} />
      <Toaster position="bottom-right" closeButton richColors />
    </NotificationProvider>,
  )
}

describe('ApiErrorEffects', () => {
  it('replays a pending episode, coalesces concurrent 401s, and resets on dismissal', async () => {
    publishAuthenticationRequired('initial')
    const onAuthenticationRequired = vi.fn()
    const originalPath = window.location.pathname
    renderEffects(onAuthenticationRequired)

    await waitFor(() => expect(visibleToasts()).toHaveLength(1))
    const notice = visibleToasts()[0]
    expect(within(notice).getByText('Autenticação necessária')).toBeVisible()
    act(() => publishAuthenticationRequired('concurrent'))
    expect(visibleToasts()).toHaveLength(1)
    expect(onAuthenticationRequired).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe(originalPath)

    fireEvent.click(
      within(notice).getByRole('button', { name: /close toast/i }),
    )
    await waitFor(() => expect(visibleToasts()).toHaveLength(0))
    act(() => publishAuthenticationRequired('retry'))
    await waitFor(() => expect(visibleToasts()).toHaveLength(1))
    expect(onAuthenticationRequired).toHaveBeenCalledTimes(2)
  })

  it('allows a future host action to complete recovery without navigation', async () => {
    const onAuthenticationRequired = vi.fn()
    renderEffects(onAuthenticationRequired)
    act(() => publishAuthenticationRequired('first'))
    await waitFor(() => expect(visibleToasts()).toHaveLength(1))
    const completeRecovery = onAuthenticationRequired.mock
      .calls[0][1] as () => void
    act(() => completeRecovery())
    await waitFor(() => expect(visibleToasts()).toHaveLength(0))

    act(() => publishAuthenticationRequired('second'))
    await waitFor(() => expect(visibleToasts()).toHaveLength(1))
    expect(onAuthenticationRequired).toHaveBeenCalledTimes(2)
  })
})
