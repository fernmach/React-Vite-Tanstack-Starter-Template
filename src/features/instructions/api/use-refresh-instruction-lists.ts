import { useQueryClient } from '@tanstack/react-query'
import { instructionKeys } from './instruction-keys'

export function useRefreshInstructionLists() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: instructionKeys.lists() })
}
