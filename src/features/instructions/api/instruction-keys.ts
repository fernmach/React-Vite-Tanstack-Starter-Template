import type { NormalizedInstructionQuery } from '../model/instruction'

export const instructionKeys = {
  all: ['instructions'] as const,
  lists: () => [...instructionKeys.all, 'list'] as const,
  list: (input: NormalizedInstructionQuery) =>
    [...instructionKeys.lists(), input] as const,
}
