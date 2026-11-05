import { lazy, Suspense, useState, type PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { createQueryClient } from '@/lib/react-query'
import { ApplicationErrorBoundary } from '@/components/errors/error-boundary'
import { AuthProvider } from '@/lib/auth/provider'

const QueryDevtools = __APP_QUERY_DEVTOOLS__
  ? lazy(async () => {
      const module = await import('@tanstack/react-query-devtools')
      return { default: module.ReactQueryDevtools }
    })
  : null

type AppProviderProps = PropsWithChildren<{
  queryClient?: ReturnType<typeof createQueryClient>
}>

export function AppProvider({ children, queryClient }: AppProviderProps) {
  return (
    <ApplicationErrorBoundary>
      <Providers queryClient={queryClient}>{children}</Providers>
    </ApplicationErrorBoundary>
  )
}

function Providers({
  children,
  queryClient: providedClient,
}: AppProviderProps) {
  const [queryClient] = useState(() => providedClient ?? createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </AuthProvider>
      {QueryDevtools ? (
        <Suspense fallback={null}>
          <QueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  )
}
