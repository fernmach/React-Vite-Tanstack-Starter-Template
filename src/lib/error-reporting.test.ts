import { CancelledError } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './api-error'
import { createErrorReporting } from './error-reporting'

describe('error reporting', () => {
  it('delivers only allowlisted structured data, never error text or arbitrary context', () => {
    const reporter = vi.fn()
    const reporting = createErrorReporting({ reporter })
    const error = new ApiError({
      kind: 'validation',
      message: 'SECRET backend message',
      status: 401,
      validationPhase: 'error-payload',
      code: 'SECRET',
      transportCode: 'SECRET',
      issueCodes: ['invalid_type', 'SECRET', 'invalid_type'],
      details: {
        headers: { cookie: 'SECRET' },
        body: 'SECRET',
        path: ['SECRET'],
      },
      cause: {
        config: { url: '/?token=SECRET', headers: { Authorization: 'SECRET' } },
      },
    })
    const context = {
      source: 'query' as const,
      queryKey: ['SECRET'],
      details: 'SECRET',
    }
    reporting.report(error, context)
    expect(reporter).toHaveBeenCalledExactlyOnceWith({
      source: 'query',
      category: 'contract',
      status: 401,
      validationPhase: 'error-payload',
      issueCodes: ['invalid_type'],
    })
    expect(JSON.stringify(reporter.mock.calls)).not.toContain('SECRET')
    expect(Object.isFrozen(reporter.mock.calls[0][0])).toBe(true)
  })

  it('deduplicates propagation but reports each new execution even with reused errors', () => {
    const reporter = vi.fn()
    const reporting = createErrorReporting({ reporter })
    const error = new Error('same text')
    reporting.reportExecution(error, { source: 'query' })
    reporting.report(error, { source: 'route' })
    reporting.report(error, { source: 'application' })
    expect(reporter).toHaveBeenCalledTimes(1)
    reporting.reportExecution(error, { source: 'query' })
    reporting.report(error, { source: 'route' })
    reporting.report(new Error('same text'), { source: 'section' })
    expect(reporter).toHaveBeenCalledTimes(3)
  })

  it('supports explicit occurrence tokens for primitive thrown values', () => {
    const reporter = vi.fn()
    const reporting = createErrorReporting({ reporter })
    const occurrence = {}
    reporting.report('private text', { source: 'route' }, occurrence)
    reporting.report('private text', { source: 'route' }, occurrence)
    reporting.report('private text', { source: 'route' }, {})
    expect(reporter).toHaveBeenCalledTimes(2)
  })

  it.each(['sync', 'async'] as const)(
    'isolates %s adapter failures',
    async (mode) => {
      const reporter = vi.fn(() => {
        if (mode === 'sync') throw new Error('reporter failed')
        return Promise.reject(new Error('reporter failed'))
      })
      const reporting = createErrorReporting({ reporter })
      const error = new Error('original')
      expect(() =>
        reporting.report(error, { source: 'application' }),
      ).not.toThrow()
      await Promise.resolve()
      reporting.report(error, { source: 'application' })
      expect(reporter).toHaveBeenCalledTimes(1)
    },
  )

  it('has a silent production default and sanitized development diagnostics', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      createErrorReporting().report(new Error('secret'), { source: 'startup' })
      expect(consoleError).not.toHaveBeenCalled()
      createErrorReporting({ development: true }).report(new Error('secret'), {
        source: 'startup',
      })
      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        '[application error]',
        { source: 'startup', category: 'runtime' },
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('ignores both Query and transport cancellation', () => {
    const reporter = vi.fn()
    const reporting = createErrorReporting({ reporter })
    reporting.report(new CancelledError(), { source: 'query' })
    reporting.report({ __CANCEL__: true }, { source: 'mutation' })
    expect(reporter).not.toHaveBeenCalled()
  })
})
