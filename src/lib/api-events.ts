export type AuthenticationRequiredEvent = {
  type: 'authentication-required'
  occurrenceId: string
}

type AuthenticationRequiredListener = (
  event: AuthenticationRequiredEvent,
) => void

const listeners = new Set<AuthenticationRequiredListener>()
let activeEvent: AuthenticationRequiredEvent | undefined

function notify(
  listener: AuthenticationRequiredListener,
  event: AuthenticationRequiredEvent,
) {
  try {
    listener(event)
  } catch {
    // An application handler must not replace the transport failure.
  }
}

export function subscribeAuthenticationRequired(
  listener: AuthenticationRequiredListener,
): () => void {
  listeners.add(listener)
  if (activeEvent) notify(listener, activeEvent)
  return () => listeners.delete(listener)
}

export function publishAuthenticationRequired(occurrenceId: string): void {
  if (activeEvent) return
  const event: AuthenticationRequiredEvent = {
    type: 'authentication-required',
    occurrenceId,
  }
  activeEvent = event
  listeners.forEach((listener) => notify(listener, event))
}

// Call only after confirmed authentication recovery or an explicit retry.
export function resetAuthenticationRequiredEpisode(
  occurrenceId?: string,
): void {
  if (occurrenceId && activeEvent?.occurrenceId !== occurrenceId) return
  activeEvent = undefined
}
