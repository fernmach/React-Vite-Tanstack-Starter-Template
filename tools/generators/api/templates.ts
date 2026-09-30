import type { ApiGeneratorOptions } from './core'

function words(value: string) {
  return value.split('-')
}

function pascalCase(value: string) {
  return words(value)
    .map((word) => `${word[0]?.toUpperCase()}${word.slice(1)}`)
    .join('')
}

function camelCase(value: string) {
  const result = pascalCase(value)
  return `${result[0]?.toLowerCase()}${result.slice(1)}`
}

export function renderQuery(options: ApiGeneratorOptions) {
  const operation = camelCase(options.name)
  const operationType = pascalCase(options.name)
  const resource = camelCase(options.resource)

  return {
    operation: `
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
import type { QueryConfig } from '@/lib/react-query'

// API_GENERATOR_TODO: replace the empty strict object with the endpoint's normalized request fields and defaults.
export const ${operation}InputSchema = z.object({}).strict()

// API_GENERATOR_TODO: replace the empty strict object with the complete successful response contract.
export const ${operation}ResponseSchema = z.object({}).strict()

export type ${operationType}Input = z.input<typeof ${operation}InputSchema>
export type Normalized${operationType}Input = z.output<typeof ${operation}InputSchema>
export type ${operationType}Response = z.infer<typeof ${operation}ResponseSchema>

export function normalize${operationType}Input(
  input: ${operationType}Input = {},
): Normalized${operationType}Input {
  try {
    return ${operation}InputSchema.parse(input)
  } catch (error) {
    // API_GENERATOR_TODO: choose 'input' for editable input or 'internal' for application-generated invariants.
    throw normalizeApiError(error, { validationPhase: 'request', requestOrigin: 'input' })
  }
}

export const ${resource}Keys = {
  all: ['${options.resource}'] as const,
  lists: () => [...${resource}Keys.all, 'list'] as const,
  list: (input: Normalized${operationType}Input) =>
    [...${resource}Keys.lists(), input] as const,
}

async function request${operationType}(input: Normalized${operationType}Input, signal?: AbortSignal) {
  // API_GENERATOR_TODO: confirm the HTTP method, endpoint path, parameter serialization, and authentication expectations.
  return apiClient.get('/${options.resource}', {
    params: input,
    signal,
    responseSchema: ${operation}ResponseSchema,
  })
}

export async function ${operation}(input: ${operationType}Input = {}, signal?: AbortSignal) {
  return request${operationType}(normalize${operationType}Input(input), signal)
}

export function ${operation}QueryOptions(input: ${operationType}Input = {}) {
  const normalized = normalize${operationType}Input(input)
  return queryOptions({
    queryKey: ${resource}Keys.list(normalized),
    queryFn: ({ signal }) => request${operationType}(normalized, signal),
    // API_GENERATOR_TODO: list only status-qualified backend codes proving an internal request-contract fault; leave empty otherwise.
    meta: { requestContractErrors: [] },
    // API_GENERATOR_TODO: confirm that retaining previous data is correct for this parameterized resource.
    placeholderData: keepPreviousData,
  })
}

type Use${operationType}Options = {
  input?: ${operationType}Input
  queryConfig?: QueryConfig<typeof ${operation}QueryOptions>
}

export function use${operationType}({
  input = {},
  queryConfig,
}: Use${operationType}Options = {}) {
  const options = ${operation}QueryOptions(input)
  return useQuery({
    ...queryConfig,
    ...options,
  })
}
`,
    test: `
import { describe, it } from 'vitest'

describe('${operation}', () => {
  // API_GENERATOR_TODO: use MSW to assert the method, path, normalized parameters, and parsed success response.
  it.todo('sends the normalized request and validates the response')

  // API_GENERATOR_TODO: cover malformed inputs and malformed HTTP responses.
  it.todo('rejects invalid request and response data')

  // API_GENERATOR_TODO: assert key equivalence after normalization and that every response-changing input is in the key.
  it.todo('builds stable query keys from every normalized input')

  // API_GENERATOR_TODO: render the generated hook with the shared Query test wrapper and an MSW handler.
  it.todo('composes supported consumer query configuration')

  // API_GENERATOR_TODO: prove abort reaches HTTP, cancellation is silent, and initial/background errors have one safe feedback owner without stale placeholder data.
  it.todo('forwards cancellation and owns safe failure recovery')

  // API_GENERATOR_TODO: cover request origin and status-qualified internal backend codes when this endpoint has them.
  it.todo('classifies request-contract failures for sanitized reporting')
})
`,
  }
}

export function renderMutation(options: ApiGeneratorOptions) {
  const operation = camelCase(options.name)
  const operationType = pascalCase(options.name)
  const resource = camelCase(options.resource)

  return {
    operation: `
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
import { errorReporting } from '@/lib/error-reporting'
import type { MutationConfig } from '@/lib/react-query'

// API_GENERATOR_TODO: replace the empty strict object with every mutation input field and validation rule.
export const ${operation}InputSchema = z.object({}).strict()

// API_GENERATOR_TODO: replace the empty strict object with the complete successful response contract.
export const ${operation}ResponseSchema = z.object({}).strict()

export type ${operationType}Input = z.infer<typeof ${operation}InputSchema>
export type ${operationType}Response = z.infer<typeof ${operation}ResponseSchema>

export const ${resource}Keys = {
  all: ['${options.resource}'] as const,
}

export async function ${operation}(input: ${operationType}Input) {
  let parsed: ${operationType}Input
  try {
    parsed = ${operation}InputSchema.parse(input)
  } catch (error) {
    // API_GENERATOR_TODO: choose 'input' for editable input or 'internal' for application-generated invariants.
    throw normalizeApiError(error, { validationPhase: 'request', requestOrigin: 'input' })
  }
  // API_GENERATOR_TODO: confirm the HTTP method, endpoint path, body serialization, and authentication expectations.
  return apiClient.post('/${options.resource}', {
    body: parsed,
    responseSchema: ${operation}ResponseSchema,
  })
}

type Use${operationType}Options = {
  mutationConfig?: MutationConfig<typeof ${operation}>
  onFollowUpError?: (phase: 'refresh' | 'callback') => void
}

export function use${operationType}({
  mutationConfig,
  onFollowUpError,
}: Use${operationType}Options = {}) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restConfig } = mutationConfig ?? {}

  const notifyFollowUpError = (phase: 'refresh' | 'callback') => {
    try {
      onFollowUpError?.(phase)
    } catch (error) {
      errorReporting.report(error, { source: 'mutation' })
    }
  }

  // API_GENERATOR_TODO: choose one visible local or global owner for write failures; keep authentication copy in the application notice.
  return useMutation({
    ...restConfig,
    // API_GENERATOR_TODO: list only status-qualified backend codes proving an internal request-contract fault; leave empty otherwise.
    meta: { ...restConfig.meta, requestContractErrors: [] },
    mutationFn: ${operation},
    onSuccess: async (data, variables, context, mutationContext) => {
      // API_GENERATOR_TODO: replace conservative invalidation with the precise cache effect; if optimistic, snapshot before mutation and roll back on failure.
      const outcomes = await Promise.allSettled([
        Promise.resolve().then(() => queryClient.invalidateQueries(
          { queryKey: ${resource}Keys.all }, { throwOnError: true },
        )),
        Promise.resolve().then(() => onSuccess?.(data, variables, context, mutationContext)),
      ])
      for (const [index, outcome] of outcomes.entries()) {
        if (outcome.status === 'rejected') {
          errorReporting.report(outcome.reason, { source: 'mutation' })
          notifyFollowUpError(index === 0 ? 'refresh' : 'callback')
        }
      }
    },
  })
}
`,
    test: `
import { describe, it } from 'vitest'

describe('${operation}', () => {
  // API_GENERATOR_TODO: use MSW to assert the method, path, exact request body, and parsed success response.
  it.todo('sends the validated mutation and validates the response')

  // API_GENERATOR_TODO: cover malformed inputs and malformed HTTP responses.
  it.todo('rejects invalid request and response data')

  // API_GENERATOR_TODO: render the hook with the shared Query test wrapper and prove the exact cache synchronization or rollback behavior.
  it.todo('applies the canonical cache effect and composes consumer callbacks')

  // API_GENERATOR_TODO: prove a confirmed write remains successful after refresh/callback failure, with a separate safe follow-up notice and report.
  it.todo('keeps confirmed write outcome when follow-up work fails')

  // API_GENERATOR_TODO: choose local or global visible feedback for write failure; test no duplicate feedback, cancellation silence, and no automatic replay.
  it.todo('owns safe mutation failure feedback without replay')
})
`,
  }
}
