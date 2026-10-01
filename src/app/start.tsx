import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { AppProvider } from './provider'
import { shouldEnableApiMocking } from '@/config/env'
import { routeTree } from '@/routeTree.gen'
import { ThemeProvider } from '@/components/theme-provider'
import { createQueryClient } from '@/lib/react-query'
import '@/index.css'

export async function startApplication() {
  if (__APP_DEVELOPMENT__ && shouldEnableApiMocking) {
    const { enableMocking } = await import('@/mocks/enable')
    await enableMocking()
  }

  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Missing application root')
  if (rootElement.innerHTML) return
  const queryClient = createQueryClient()
  const router = createRouter({ routeTree, context: { queryClient } })
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <AppProvider queryClient={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <RouterProvider router={router} />
        </ThemeProvider>
      </AppProvider>
    </React.StrictMode>,
  )
}
