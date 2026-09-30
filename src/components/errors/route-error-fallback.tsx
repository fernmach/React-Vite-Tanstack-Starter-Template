import { useEffect, useState } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { errorReporting } from '@/lib/error-reporting'
import { ErrorFallback } from './error-fallback'

export function RouteErrorFallback({
  error,
  reset,
  invalidate,
}: ErrorComponentProps & { invalidate: () => Promise<void> }) {
  const [occurrence] = useState(() => ({}))
  useEffect(() => {
    // The token covers primitive throws and StrictMode effect replay.
    errorReporting.report(
      error,
      { source: 'route' },
      typeof error === 'object' && error !== null ? undefined : occurrence,
    )
  }, [error, occurrence])

  async function retry() {
    try {
      errorReporting.beginAttempt(error)
      // A React reset alone would rethrow a cached loader failure.
      await invalidate()
      reset()
    } catch (retryError) {
      errorReporting.report(retryError, { source: 'route' })
    }
  }

  return (
    <ErrorFallback
      scope="route"
      onReset={() => {
        void retry()
      }}
    />
  )
}
