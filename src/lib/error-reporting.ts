import { ApiError, isApiCancellation } from './api-error'

export type ErrorSource =
  | 'query'
  | 'mutation'
  | 'application'
  | 'route'
  | 'section'
  | 'startup'
export type ErrorContext = {
  source: ErrorSource
  internalRequestFailure?: boolean
}

// Only these fields cross the adapter boundary. No raw error is delivered.
export type ErrorReport = Readonly<{
  source: ErrorSource
  category: 'contract' | 'server' | 'runtime'
  validationPhase?: 'request' | 'response' | 'error-payload' | 'environment'
  status?: number
  issueCodes?: readonly string[]
}>
export type ErrorReporter = (report: ErrorReport) => void | Promise<void>

const sources: readonly string[] = [
  'query',
  'mutation',
  'application',
  'route',
  'section',
  'startup',
]
const phases: readonly string[] = [
  'request',
  'response',
  'error-payload',
  'environment',
]
const issueCodes = new Set([
  'invalid_type',
  'too_big',
  'too_small',
  'invalid_format',
  'not_multiple_of',
  'unrecognized_keys',
  'invalid_union',
  'invalid_key',
  'invalid_element',
  'invalid_value',
  'custom',
])

function sanitize(
  error: unknown,
  context: ErrorContext,
): ErrorReport | undefined {
  if (isApiCancellation(error)) return
  const source = sources.includes(context.source)
    ? context.source
    : 'application'
  if (!(error instanceof ApiError))
    return Object.freeze({ source, category: 'runtime' })

  let category: ErrorReport['category']
  if (error.kind === 'unknown') category = 'runtime'
  else if (error.kind === 'validation') {
    if (
      error.validationPhase === 'request' &&
      error.requestOrigin !== 'internal' &&
      !context.internalRequestFailure
    )
      return
    category = 'contract'
  } else if (context.internalRequestFailure) category = 'contract'
  else if (
    error.kind === 'http' &&
    error.status &&
    error.status >= 500 &&
    error.status <= 599
  )
    category = 'server'
  else return

  return Object.freeze({
    source,
    category,
    ...(error.validationPhase && phases.includes(error.validationPhase)
      ? { validationPhase: error.validationPhase }
      : {}),
    ...(Number.isInteger(error.status) &&
    error.status! >= 100 &&
    error.status! <= 599
      ? { status: error.status }
      : {}),
    ...(error.issueCodes
      ? {
          issueCodes: Object.freeze(
            [
              ...new Set(
                error.issueCodes.filter((code) => issueCodes.has(code)),
              ),
            ].slice(0, 11),
          ),
        }
      : {}),
  })
}

export function createErrorReporting({
  reporter,
  development = false,
}: { reporter?: ErrorReporter; development?: boolean } = {}) {
  const reported = new WeakSet<object>()
  const executions = new WeakMap<object, object>()
  let adapter = reporter
  let diagnostics = development

  function report(error: unknown, context: ErrorContext, occurrence?: object) {
    // Isolation includes sanitization: unusual thrown objects must not break recovery.
    try {
      const record = sanitize(error, context)
      if (!record) return
      const object =
        (typeof error === 'object' && error !== null) ||
        typeof error === 'function'
          ? (error as object)
          : undefined
      const identity =
        occurrence ?? (object ? (executions.get(object) ?? object) : undefined)
      if (identity && reported.has(identity)) return
      if (identity) reported.add(identity)
      if (object && occurrence) executions.set(object, occurrence)
      const result = adapter
        ? adapter(record)
        : diagnostics
          ? console.error('[application error]', record)
          : undefined
      void Promise.resolve(result).catch(() => {
        /* Reporting must never fail the operation. */
      })
    } catch {
      /* No recursive reporting of reporter failures. */
    }
  }

  return {
    report,
    beginAttempt(error: unknown) {
      if (
        (typeof error === 'object' && error !== null) ||
        typeof error === 'function'
      ) {
        executions.set(error, {})
      }
    },
    // Cache callbacks run once per execution, including reused Error objects.
    // Associate that execution with later boundary propagation.
    reportExecution(error: unknown, context: ErrorContext) {
      report(error, context, {})
    },
    configure(options: { reporter?: ErrorReporter; development?: boolean }) {
      if ('reporter' in options) adapter = options.reporter
      if (options.development !== undefined) diagnostics = options.development
    },
  }
}

export const errorReporting = createErrorReporting()
