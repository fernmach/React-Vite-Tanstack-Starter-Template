import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  resetAuthenticationRequiredEpisode,
  subscribeAuthenticationRequired,
  type AuthenticationRequiredEvent,
} from '@/lib/api-events'
import { authKeys, refreshSession } from '@/lib/auth/api'
import type { AuthSession } from '@/lib/auth/model'
import { useNotifications } from '@/lib/notifications'

const noticeId = (event: AuthenticationRequiredEvent) =>
  `session-expired:${event.occurrenceId}`

type RecoveryFlight = {
  promise: Promise<void>
}

export function ApiErrorEffects() {
  const queryClient = useQueryClient()
  const { show } = useNotifications()
  const recoveryFlight = useRef<RecoveryFlight | null>(null)

  useEffect(() => {
    const recover = (event: AuthenticationRequiredEvent) => {
      if (recoveryFlight.current) return recoveryFlight.current.promise

      const promise = (async () => {
        const currentSession = queryClient.getQueryData<AuthSession>(
          authKeys.session(),
        )
        let refreshedSession: AuthSession

        try {
          if (!currentSession) throw new Error('Missing in-memory session')

          refreshedSession = await queryClient.fetchQuery({
            queryKey: authKeys.session(),
            queryFn: () => refreshSession(currentSession.csrfToken),
            staleTime: 0,
            meta: { requiresAuth: false },
          })
        } catch {
          await queryClient.cancelQueries({
            predicate: (query) => query.meta?.requiresAuth === true,
          })
          queryClient.removeQueries({
            predicate: (query) => query.meta?.requiresAuth === true,
          })

          if (currentSession) {
            queryClient.setQueryData(authKeys.session(), {
              user: null,
              csrfToken: currentSession.csrfToken,
            } satisfies AuthSession)
          } else {
            queryClient.removeQueries({
              queryKey: authKeys.session(),
              exact: true,
            })
          }

          recoveryFlight.current = null
          resetAuthenticationRequiredEpisode(event.occurrenceId)
          show({
            id: noticeId(event),
            title: 'Sessão expirada',
            description: 'Entre novamente para continuar.',
            tone: 'error',
          })
          return
        }

        queryClient.setQueryData(authKeys.session(), refreshedSession)
        recoveryFlight.current = null
        resetAuthenticationRequiredEpisode(event.occurrenceId)

        await queryClient
          .refetchQueries({
            type: 'active',
            predicate: (query) => query.meta?.requiresAuth === true,
          })
          .catch(() => undefined)
      })()

      recoveryFlight.current = { promise }
      return promise
    }

    return subscribeAuthenticationRequired((event) => {
      void recover(event)
    })
  }, [queryClient, show])

  return null
}
