import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { AppProvider } from './provider'
import { shouldEnableApiMocking } from '@/config/env'
import { routeTree } from '@/routeTree.gen'
import { ThemeProvider } from '@/components/theme-provider'
import '@/index.css'

export async function startApplication() {
  if (__APP_DEVELOPMENT__ && shouldEnableApiMocking) {
    const { enableMocking } = await import('@/mocks/enable')
    await enableMocking()
  }

  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Missing application root')
  if (rootElement.innerHTML) return
  const router = createRouter({ routeTree })
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <AppProvider>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <RouterProvider router={router} />
        </ThemeProvider>
      </AppProvider>
    </React.StrictMode>,
  )
}
