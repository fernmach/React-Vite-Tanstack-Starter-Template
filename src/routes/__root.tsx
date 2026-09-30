import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { AppShell } from '@/app/layouts/app-shell'
import { ApiErrorEffects } from '@/app/api-error-effects'
import { RouteError } from '@/app/route-error'
import { Toaster } from '@/components/ui/sonner'

export const Route = createRootRoute({
  errorComponent: RouteError,
  component: () => (
    <AppShell>
      <ApiErrorEffects />
      <Outlet />
      <Toaster position="bottom-right" closeButton richColors />
      <TanStackRouterDevtools />
    </AppShell>
  ),
})
