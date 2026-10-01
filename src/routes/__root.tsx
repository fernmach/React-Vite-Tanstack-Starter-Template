import { lazy, Suspense } from 'react'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/app/layouts/app-shell'
import { ApiErrorEffects } from '@/app/api-error-effects'
import { RouteError } from '@/app/route-error'
import { Toaster } from '@/components/ui/sonner'
import type { AuthRouteContext } from '@/lib/auth/route-guards'

const RouterDevtools = __APP_ROUTER_DEVTOOLS__
  ? lazy(async () => {
      const module = await import('@tanstack/router-devtools')
      return { default: module.TanStackRouterDevtools }
    })
  : null

export const Route = createRootRouteWithContext<AuthRouteContext>()({
  errorComponent: RouteError,
  component: () => (
    <AppShell>
      <ApiErrorEffects />
      <Outlet />
      <Toaster position="bottom-right" closeButton richColors />
      {RouterDevtools ? (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      ) : null}
    </AppShell>
  ),
})
