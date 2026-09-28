import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { AppProvider } from '@/app/provider'
import { shouldEnableApiMocking } from '@/config/env'
import { routeTree } from './routeTree.gen'
import { ThemeProvider } from '@/components/theme-provider'
import './index.css'

const router = createRouter({ routeTree })

async function startApplication() {
  if (shouldEnableApiMocking) {
    const { enableMocking } = await import('@/mocks/enable')
    await enableMocking()
  }

  const rootElement = document.getElementById('root')!
  if (rootElement.innerHTML) return

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

await startApplication()
