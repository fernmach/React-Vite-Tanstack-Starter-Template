import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrap } from './bootstrap'

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('@/mocks/enable')
  vi.doUnmock('@/lib/error-reporting')
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('startup containment', () => {
  it('starts the application once when import and initialization succeed', async () => {
    const startApplication = vi.fn(async () => {})
    await bootstrap(async () => ({ startApplication }))
    expect(startApplication).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('catches environment failure during the real application module import', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', '')
    const { errorReporting } = await import('@/lib/error-reporting')
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    await bootstrap(() => import('@/app/start'))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível iniciar a aplicação.',
    )
    expect(document.body).not.toHaveTextContent(/VITE_API_URL|Zod|environment/)
    expect(
      screen.getByRole('button', { name: 'Recarregar aplicação' }),
    ).toBeVisible()
    expect(reporter).toHaveBeenCalledExactlyOnceWith({
      source: 'startup',
      category: 'contract',
      validationPhase: 'environment',
      issueCodes: ['too_small', 'custom'],
    })
  })

  it('catches mock initialization rejection before React mounts', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_ENABLE_API_MOCKING', 'true')
    const enableMocking = vi.fn(async () => {
      throw new Error('SECRET worker diagnostic')
    })
    vi.doMock('@/mocks/enable', () => ({ enableMocking }))
    const { errorReporting } = await import('@/lib/error-reporting')
    const reporter = vi.fn()
    errorReporting.configure({ reporter })
    await bootstrap(() => import('@/app/start'))
    expect(enableMocking).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeVisible()
    expect(document.body).not.toHaveTextContent('SECRET')
    expect(reporter).toHaveBeenCalledExactlyOnceWith({
      source: 'startup',
      category: 'runtime',
    })
  })

  it('renders even without a root container or an importable reporter', async () => {
    vi.resetModules()
    vi.doMock('@/lib/error-reporting', () => {
      throw new Error('reporter import failed')
    })
    document.body.replaceChildren()
    const load = vi.fn(async () => {
      throw new Error('SECRET import failure')
    })
    await expect(bootstrap(load)).resolves.toBeUndefined()
    expect(screen.getByRole('alert')).toBeVisible()
    expect(document.body).not.toHaveTextContent('SECRET')
    expect(load).toHaveBeenCalledTimes(1)
  })
})
