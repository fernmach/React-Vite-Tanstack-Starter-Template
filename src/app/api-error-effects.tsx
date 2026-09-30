import { useEffect } from 'react'
import {
  resetAuthenticationRequiredEpisode,
  subscribeAuthenticationRequired,
  type AuthenticationRequiredEvent,
} from '@/lib/api-events'
import { useNotifications } from '@/lib/notifications'

const noticeId = (event: AuthenticationRequiredEvent) =>
  `authentication-required:${event.occurrenceId}`

export function ApiErrorEffects({
  onAuthenticationRequired,
}: {
  onAuthenticationRequired?: (
    event: AuthenticationRequiredEvent,
    completeRecovery: () => void,
  ) => void
}) {
  const { show, dismiss } = useNotifications()

  useEffect(
    () =>
      subscribeAuthenticationRequired((event) => {
        const id = noticeId(event)
        const completeRecovery = () => dismiss(id)
        const added = show({
          id,
          title: 'Autenticação necessária',
          description:
            'Não foi possível acessar este recurso. Autentique-se para continuar.',
          tone: 'error',
          onDismiss: () =>
            resetAuthenticationRequiredEpisode(event.occurrenceId),
        })
        if (added) onAuthenticationRequired?.(event, completeRecovery)
      }),
    [show, dismiss, onAuthenticationRequired],
  )

  return null
}
