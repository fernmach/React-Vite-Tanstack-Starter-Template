import { useState, type PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { env } from '@/config/env'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { createQueryClient } from '@/lib/react-query'
import { ApplicationErrorBoundary } from '@/components/errors/error-boundary'

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <ApplicationErrorBoundary>
      <Providers>{children}</Providers>
    </ApplicationErrorBoundary>
  )
}

function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>{children}</NotificationProvider>
      {env.IS_DEVELOPMENT ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}
