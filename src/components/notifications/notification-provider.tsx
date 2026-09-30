import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { NotificationContext, type Notification } from '@/lib/notifications'
import { NotificationSurface } from './notification-surface'

export function NotificationProvider({ children }: PropsWithChildren) {
  const active = useRef(new Map<string, Notification>())
  const [notifications, setNotifications] = useState<Notification[]>([])

  const show = useCallback((notification: Notification) => {
    if (active.current.has(notification.id)) return false
    active.current.set(notification.id, notification)
    setNotifications([...active.current.values()])
    return true
  }, [])

  const dismiss = useCallback((id: string) => {
    const notification = active.current.get(id)
    if (!notification) return
    active.current.delete(id)
    setNotifications([...active.current.values()])
    notification.onDismiss?.()
  }, [])

  const controls = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <NotificationContext.Provider value={controls}>
      {children}
      <NotificationSurface notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  )
}
