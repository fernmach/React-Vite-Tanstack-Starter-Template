import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
import { errorReporting } from '@/lib/error-reporting'
import type { MutationConfig } from '@/lib/react-query'
import { instructionSchema } from '../model/instruction'
import { instructionKeys } from './instruction-keys'

export { instructionSchema }

export const archiveInstructionInputSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict()

export type ArchiveInstructionInput = z.infer<
  typeof archiveInstructionInputSchema
>

function parseInput(input: ArchiveInstructionInput) {
  try {
    return archiveInstructionInputSchema.parse(input)
  } catch (error) {
    throw normalizeApiError(error, {
      validationPhase: 'request',
      requestOrigin: 'internal',
    })
  }
}

export async function archiveInstruction(input: ArchiveInstructionInput) {
  const { id } = parseInput(input)
  return apiClient.patch(`/instructions/${encodeURIComponent(id)}`, {
    body: { archived: true },
    responseSchema: instructionSchema,
  })
}

type UseArchiveInstructionOptions = {
  mutationConfig?: MutationConfig<typeof archiveInstruction>
  onFollowUpError?: (phase: 'refresh' | 'callback') => void
}

export function useArchiveInstruction({
  mutationConfig,
  onFollowUpError,
}: UseArchiveInstructionOptions = {}) {
  const queryClient = useQueryClient()
  const notifyFollowUpError = (phase: 'refresh' | 'callback') => {
    try {
      onFollowUpError?.(phase)
    } catch (error) {
      errorReporting.report(error, { source: 'mutation' })
    }
  }
  const { onSuccess, ...restConfig } = mutationConfig ?? {}

  return useMutation({
    ...restConfig,
    meta: {
      ...restConfig.meta,
      requestContractErrors: [{ status: 400, code: 'INVALID_PATCH_BODY' }],
    },
    mutationFn: archiveInstruction,
    onSuccess: async (data, variables, context, mutationContext) => {
      const outcomes = await Promise.allSettled([
        Promise.resolve().then(() =>
          queryClient.invalidateQueries(
            { queryKey: instructionKeys.lists() },
            { throwOnError: true },
          ),
        ),
        Promise.resolve().then(() =>
          onSuccess?.(data, variables, context, mutationContext),
        ),
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
