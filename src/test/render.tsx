import type { ReactElement } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  render as testingLibraryRender,
  renderHook as testingLibraryRenderHook,
  type RenderHookOptions,
  type RenderOptions,
} from '@testing-library/react'
import { createQueryClient } from '@/lib/react-query'

type QueryRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  queryClient?: QueryClient
}

export function render(
  ui: ReactElement,
  { queryClient = createQueryClient(), ...options }: QueryRenderOptions = {},
) {
  return {
    queryClient,
    ...testingLibraryRender(ui, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
      ...options,
    }),
  }
}

type QueryRenderHookOptions<Props> = Omit<
  RenderHookOptions<Props>,
  'wrapper'
> & {
  queryClient?: QueryClient
}

export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  {
    queryClient = createQueryClient(),
    ...options
  }: QueryRenderHookOptions<Props> = {},
) {
  return {
    queryClient,
    ...testingLibraryRenderHook(callback, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
      ...options,
    }),
  }
}

export { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
