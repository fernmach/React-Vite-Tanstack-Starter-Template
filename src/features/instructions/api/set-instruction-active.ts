import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
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
    throw normalizeApiError(error)
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
}

export function useSetInstructionActive({
  mutationConfig,
}: UseSetInstructionActiveOptions = {}) {
  const queryClient = useQueryClient()
  const { onMutate, onError, onSettled, ...restConfig } = mutationConfig ?? {}

  return useMutation({
    ...restConfig,
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
        await queryClient.invalidateQueries({
          queryKey: instructionKeys.lists(),
        })
        throw consumerError
      }
    },
    onSettled: (data, error, input, context, mutationContext) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: instructionKeys.lists() }),
        onSettled?.(
          data,
          error,
          input,
          context?.consumerContext,
          mutationContext,
        ),
      ]).then(() => undefined),
  })
}
