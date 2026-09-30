import { X } from 'lucide-react'
import type { Notification } from '@/lib/notifications'

export function NotificationSurface({
  notifications,
  onDismiss,
}: {
  notifications: readonly Notification[]
  onDismiss: (id: string) => void
}) {
  if (notifications.length === 0) return null

  return (
    <section
      aria-label="Notificações"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          role={notification.tone === 'info' ? 'status' : 'alert'}
          className="border-border bg-card text-card-foreground pointer-events-auto rounded-md border p-4 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{notification.title}</p>
              {notification.description ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  {notification.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={`Dispensar notificação: ${notification.title}`}
              className="focus-visible:ring-ring rounded-sm p-1 focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => onDismiss(notification.id)}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
