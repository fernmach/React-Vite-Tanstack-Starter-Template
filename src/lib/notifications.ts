import { createContext, useContext } from 'react'

export type Notification = {
  id: string
  title: string
  description?: string
  tone?: 'error' | 'info'
  onDismiss?: () => void
}

export type NotificationControls = {
  show: (notification: Notification) => boolean
  dismiss: (id: string) => void
}

export const NotificationContext = createContext<NotificationControls | null>(
  null,
)

export function useNotifications(): NotificationControls {
  const controls = useContext(NotificationContext)
  if (!controls) {
    throw new Error('useNotifications requires NotificationProvider')
  }
  return controls
}
