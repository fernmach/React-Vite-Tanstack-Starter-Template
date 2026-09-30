import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { normalizeApiError } from '@/lib/api-error'
import type { QueryConfig } from '@/lib/react-query'
import {
  instructionPageSchema,
  instructionQuerySchema,
  type InstructionQuery,
  type NormalizedInstructionQuery,
} from '../model/instruction'
import { instructionKeys } from './instruction-keys'

export { instructionPageSchema, instructionQuerySchema }

export type GetInstructionsInput = InstructionQuery

export function normalizeInstructionsInput(
  input: GetInstructionsInput = {},
): NormalizedInstructionQuery {
  try {
    return instructionQuerySchema.parse(input)
  } catch (error) {
    throw normalizeApiError(error, {
      validationPhase: 'request',
      requestOrigin: 'internal',
    })
  }
}

export async function getInstructions(
  input: GetInstructionsInput = {},
  signal?: AbortSignal,
) {
  const params = normalizeInstructionsInput(input)
  return requestInstructions(params, signal)
}

function requestInstructions(
  params: NormalizedInstructionQuery,
  signal?: AbortSignal,
) {
  return apiClient.get('/instructions', {
    params,
    signal,
    responseSchema: instructionPageSchema,
  })
}

export function getInstructionsQueryOptions(input: GetInstructionsInput = {}) {
  const normalized = normalizeInstructionsInput(input)
  return queryOptions({
    queryKey: instructionKeys.list(normalized),
    queryFn: ({ signal }) => requestInstructions(normalized, signal),
    placeholderData: keepPreviousData,
    meta: {
      requestContractErrors: [{ status: 400, code: 'INVALID_PAGINATION' }],
    },
  })
}

type UseInstructionsOptions = {
  input?: GetInstructionsInput
  queryConfig?: QueryConfig<typeof getInstructionsQueryOptions>
}

export function useInstructions({
  input = {},
  queryConfig,
}: UseInstructionsOptions = {}) {
  const options = getInstructionsQueryOptions(input)
  return useQuery({
    ...queryConfig,
    ...options,
  })
}
