import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
import { errorReporting } from '@/lib/error-reporting'
import type { MutationConfig } from '@/lib/react-query'
import {
  instructionPageSchema,
  instructionSchema,
  type InstructionPage,
} from '../model/instruction'
import { instructionKeys } from './instruction-keys'

export { instructionPageSchema, instructionSchema }

export const setInstructionActiveInputSchema = z
  .object({
    id: z.string().trim().min(1),
    active: z.boolean(),
  })
  .strict()

export type SetInstructionActiveInput = z.infer<
  typeof setInstructionActiveInputSchema
>

function parseInput(input: SetInstructionActiveInput) {
  try {
    return setInstructionActiveInputSchema.parse(input)
  } catch (error) {
    throw normalizeApiError(error, {
      validationPhase: 'request',
      requestOrigin: 'internal',
    })
  }
}

export async function setInstructionActive(input: SetInstructionActiveInput) {
  const { id, active } = parseInput(input)
  return apiClient.patch(`/instructions/${encodeURIComponent(id)}`, {
    body: { active },
    responseSchema: instructionSchema,
  })
}

type Snapshot = Array<[QueryKey, InstructionPage | undefined]>

type UseSetInstructionActiveOptions = {
  mutationConfig?: MutationConfig<typeof setInstructionActive>
  onFollowUpError?: (phase: 'refresh' | 'callback') => void
}

export function useSetInstructionActive({
  mutationConfig,
  onFollowUpError,
}: UseSetInstructionActiveOptions = {}) {
  const queryClient = useQueryClient()
  const notifyFollowUpError = (phase: 'refresh' | 'callback') => {
    try {
      onFollowUpError?.(phase)
    } catch (error) {
      errorReporting.report(error, { source: 'mutation' })
    }
  }
  const { onMutate, onError, onSuccess, onSettled, ...restConfig } =
    mutationConfig ?? {}

  return useMutation({
    ...restConfig,
    meta: {
      ...restConfig.meta,
      requestContractErrors: [{ status: 400, code: 'INVALID_PATCH_BODY' }],
    },
    mutationFn: setInstructionActive,
    onMutate: async (input, context) => {
      const parsed = parseInput(input)
      await queryClient.cancelQueries({ queryKey: instructionKeys.lists() })
      const snapshots: Snapshot = queryClient.getQueriesData<InstructionPage>({
        queryKey: instructionKeys.lists(),
      })

      queryClient.setQueriesData(
        { queryKey: instructionKeys.lists() },
        (current: unknown) => {
          const page = instructionPageSchema.safeParse(current)
          if (!page.success) return current

          return {
            ...page.data,
            items: page.data.items.map((instruction) =>
              instruction.id === parsed.id
                ? { ...instruction, active: parsed.active }
                : instruction,
            ),
          }
        },
      )

      try {
        const consumerContext = await onMutate?.(input, context)
        return { snapshots, consumerContext }
      } catch (error) {
        snapshots.forEach(([key, page]) => {
          queryClient.setQueryData(key, page)
        })
        throw normalizeApiError(error)
      }
    },
    onError: async (error, input, context, mutationContext) => {
      context?.snapshots.forEach(([key, page]) => {
        queryClient.setQueryData(key, page)
      })
      try {
        return await onError?.(
          error,
          input,
          context?.consumerContext,
          mutationContext,
        )
      } catch (consumerError) {
        errorReporting.report(consumerError, { source: 'mutation' })
      }
    },
    onSuccess: async (data, input, context, mutationContext) => {
      try {
        await onSuccess?.(
          data,
          input,
          context?.consumerContext,
          mutationContext,
        )
      } catch (error) {
        errorReporting.report(error, { source: 'mutation' })
        notifyFollowUpError('callback')
      }
    },
    onSettled: async (data, error, input, context, mutationContext) => {
      const outcomes = await Promise.allSettled([
        Promise.resolve().then(() =>
          queryClient.invalidateQueries(
            { queryKey: instructionKeys.lists() },
            { throwOnError: true },
          ),
        ),
        Promise.resolve().then(() =>
          onSettled?.(
            data,
            error,
            input,
            context?.consumerContext,
            mutationContext,
          ),
        ),
      ])
      for (const [index, outcome] of outcomes.entries()) {
        if (outcome.status === 'rejected') {
          errorReporting.report(outcome.reason, { source: 'mutation' })
          if (!error) notifyFollowUpError(index === 0 ? 'refresh' : 'callback')
        }
      }
    },
  })
}
