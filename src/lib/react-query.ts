import { QueryClient, type UseMutationOptions } from '@tanstack/react-query'
import type { ApiError } from './api-error'

export function createQueryClient() {
  return new QueryClient({
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
