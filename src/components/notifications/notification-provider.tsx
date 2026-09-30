import { useCallback, useMemo, useRef, type PropsWithChildren } from 'react'
import { toast } from 'sonner'
import { NotificationContext, type Notification } from '@/lib/notifications'

export function NotificationProvider({ children }: PropsWithChildren) {
  const active = useRef(new Map<string, Notification>())

  const finish = useCallback((id: string) => {
    const notification = active.current.get(id)
    if (!notification) return
    active.current.delete(id)
    notification.onDismiss?.()
  }, [])

  const show = useCallback(
    (notification: Notification) => {
      if (active.current.has(notification.id)) return false
      active.current.set(notification.id, notification)

      const notify = notification.tone === 'info' ? toast.info : toast.error
      notify(notification.title, {
        id: notification.id,
        description: notification.description,
        duration: Number.POSITIVE_INFINITY,
        onDismiss: () => finish(notification.id),
        onAutoClose: () => finish(notification.id),
      })
      return true
    },
    [finish],
  )

  const dismiss = useCallback(
    (id: string) => {
      if (!active.current.has(id)) return
      toast.dismiss(id)
      finish(id)
    },
    [finish],
  )

  const controls = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <NotificationContext.Provider value={controls}>
      {children}
    </NotificationContext.Provider>
  )
}
