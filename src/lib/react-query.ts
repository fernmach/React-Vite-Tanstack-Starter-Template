import {
  MutationCache,
  QueryCache,
  QueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { ApiError } from './api-error'
import { errorReporting } from './error-reporting'

interface OperationMeta extends Record<string, unknown> {
  // Feature-owned, status-qualified codes for application-generated requests.
  requestContractErrors?: readonly { status: number; code: string }[]
  // Auth recovery may selectively refetch or remove only protected server data.
  requiresAuth?: boolean
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: OperationMeta
    mutationMeta: OperationMeta
  }
}

function isInternalRequestFailure(error: unknown, meta?: OperationMeta) {
  return (
    error instanceof ApiError &&
    error.kind === 'http' &&
    error.codeSource === 'backend' &&
    meta?.requestContractErrors?.some(
      ({ status, code }) => error.status === status && error.code === code,
    ) === true
  )
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        errorReporting.reportExecution(error, {
          source: 'query',
          internalRequestFailure: isInternalRequestFailure(error, query.meta),
        }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        errorReporting.reportExecution(error, {
          source: 'mutation',
          internalRequestFailure: isInternalRequestFailure(
            error,
            mutation.meta,
          ),
        }),
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

type QueryOptionsFactory = (...args: never[]) => object

export type QueryConfig<TFactory extends QueryOptionsFactory> = Omit<
  ReturnType<TFactory>,
  'queryFn' | 'queryKey'
>

type MutationFunction = (variables: never) => Promise<unknown>

export type MutationConfig<TMutation extends MutationFunction> = Omit<
  UseMutationOptions<
    Awaited<ReturnType<TMutation>>,
    ApiError,
    Parameters<TMutation>[0]
  >,
  'mutationFn'
>
