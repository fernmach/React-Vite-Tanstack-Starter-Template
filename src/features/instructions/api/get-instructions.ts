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
    throw normalizeApiError(error)
  }
}

export async function getInstructions(input: GetInstructionsInput = {}) {
  const params = normalizeInstructionsInput(input)
  return requestInstructions(params)
}

function requestInstructions(params: NormalizedInstructionQuery) {
  return apiClient.get('/instructions', {
    params,
    responseSchema: instructionPageSchema,
  })
}

export function getInstructionsQueryOptions(input: GetInstructionsInput = {}) {
  const normalized = normalizeInstructionsInput(input)
  return queryOptions({
    queryKey: instructionKeys.list(normalized),
    queryFn: () => requestInstructions(normalized),
    placeholderData: keepPreviousData,
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
