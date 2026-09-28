import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { AppShell } from '@/app/layouts/app-shell'

export const Route = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
      <TanStackRouterDevtools />
    </AppShell>
  ),
})
