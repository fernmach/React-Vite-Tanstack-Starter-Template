import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
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
    throw normalizeApiError(error)
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
}

export function useArchiveInstruction({
  mutationConfig,
}: UseArchiveInstructionOptions = {}) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restConfig } = mutationConfig ?? {}

  return useMutation({
    ...restConfig,
    mutationFn: archiveInstruction,
    onSuccess: (data, variables, context, mutationContext) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: instructionKeys.lists() }),
        onSuccess?.(data, variables, context, mutationContext),
      ]).then(() => undefined),
  })
}
