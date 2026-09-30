import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  publishAuthenticationRequired,
  resetAuthenticationRequiredEpisode,
  subscribeAuthenticationRequired,
} from './api-events'

afterEach(() => resetAuthenticationRequiredEpisode())

describe('authentication-required event channel', () => {
  it('coalesces one episode, replays it to a late subscriber, and resets explicitly', () => {
    const first = vi.fn()
    const unsubscribeFirst = subscribeAuthenticationRequired(first)

    publishAuthenticationRequired('first')
    publishAuthenticationRequired('concurrent')
    expect(first).toHaveBeenCalledExactlyOnceWith({
      type: 'authentication-required',
      occurrenceId: 'first',
    })

    const late = vi.fn()
    const unsubscribeLate = subscribeAuthenticationRequired(late)
    expect(late).toHaveBeenCalledExactlyOnceWith({
      type: 'authentication-required',
      occurrenceId: 'first',
    })

    resetAuthenticationRequiredEpisode()
    publishAuthenticationRequired('retry')
    expect(first).toHaveBeenCalledTimes(2)
    expect(late).toHaveBeenLastCalledWith({
      type: 'authentication-required',
      occurrenceId: 'retry',
    })

    unsubscribeFirst()
    unsubscribeLate()
  })

  it('isolates a failing listener and honors unsubscribe', () => {
    const failing = vi.fn(() => {
      throw new Error('private handler detail')
    })
    const healthy = vi.fn()
    const unsubscribeFailing = subscribeAuthenticationRequired(failing)
    const unsubscribeHealthy = subscribeAuthenticationRequired(healthy)

    expect(() => publishAuthenticationRequired('first')).not.toThrow()
    expect(healthy).toHaveBeenCalledTimes(1)

    unsubscribeFailing()
    unsubscribeHealthy()
    resetAuthenticationRequiredEpisode()
    publishAuthenticationRequired('second')
    expect(healthy).toHaveBeenCalledTimes(1)
  })

  it('does not let an old notice reset a newer authentication episode', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAuthenticationRequired(listener)

    publishAuthenticationRequired('old')
    resetAuthenticationRequiredEpisode('old')
    publishAuthenticationRequired('new')
    resetAuthenticationRequiredEpisode('old')

    const late = vi.fn()
    const unsubscribeLate = subscribeAuthenticationRequired(late)
    expect(late).toHaveBeenCalledExactlyOnceWith({
      type: 'authentication-required',
      occurrenceId: 'new',
    })

    unsubscribe()
    unsubscribeLate()
  })
})
