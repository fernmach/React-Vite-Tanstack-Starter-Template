import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { errorReporting } from '@/lib/error-reporting'
import { RouteErrorFallback } from './route-error-fallback'

afterEach(() =>
  errorReporting.configure({ reporter: undefined, development: false }),
)

it('renders without providers and awaits invalidation before resetting', async () => {
  const user = userEvent.setup()
  const reporter = vi.fn()
  errorReporting.configure({ reporter })
  let finish!: () => void
  const invalidate = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const reset = vi.fn()
  render(
    <RouteErrorFallback
      error={new Error('SECRET')}
      reset={reset}
      invalidate={invalidate}
    />,
  )
  expect(screen.getByRole('alert')).toBeVisible()
  expect(document.body).not.toHaveTextContent('SECRET')
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(invalidate).toHaveBeenCalledTimes(1)
  expect(reset).not.toHaveBeenCalled()
  finish()
  await waitFor(() => expect(reset).toHaveBeenCalledTimes(1))
})

it('keeps recovery controls visible and consumes invalidation rejection', async () => {
  const user = userEvent.setup()
  const reporter = vi.fn()
  errorReporting.configure({ reporter })
  const reset = vi.fn()
  render(
    <RouteErrorFallback
      error={new Error('initial')}
      reset={reset}
      invalidate={async () => {
        throw new Error('SECRET invalidation')
      }}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(
    screen.getByRole('button', { name: 'Recarregar aplicação' }),
  ).toBeVisible()
  expect(reset).not.toHaveBeenCalled()
  expect(reporter).toHaveBeenCalledTimes(2)
  expect(document.body).not.toHaveTextContent('SECRET')
})
