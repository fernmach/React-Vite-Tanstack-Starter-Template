import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { AuthControls } from './auth-controls'
import { AppMobileNav } from './mobile-nav'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell bg-background text-foreground min-h-screen">
      <header>
        <div className="border-border bg-card border-b">
          <div className="mx-auto flex min-h-14 max-w-[1600px] items-center justify-between gap-4 px-4 py-2 sm:px-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <span className="text-primary shrink-0 text-xl font-bold tracking-tight italic">
                Grendene
              </span>
              <span className="text-primary hidden truncate text-xs font-bold tracking-[0.12em] uppercase md:inline">
                Instruções de Montagem de MPV
              </span>
              <span className="bg-primary text-primary-foreground rounded-sm px-2 py-1 text-xs font-medium tracking-wide uppercase">
                Homologação
              </span>
            </div>
            <div className="ml-auto">
              <AuthControls />
            </div>
            <AppMobileNav />
          </div>
        </div>
        <nav aria-label="Navegação principal" className="bg-primary">
          <div className="mx-auto flex max-w-[1600px] px-4 sm:px-8">
            <Link
              to="/instrucoes"
              className="bg-primary-foreground/15 text-primary-foreground border-primary-foreground/40 border-b-2 px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-current"
              activeOptions={{ exact: false }}
            >
              Instruções
            </Link>
          </div>
        </nav>
      </header>
      {children}
    </div>
  )
}
