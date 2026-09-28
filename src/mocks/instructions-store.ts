import type { Instruction } from '@/features/instructions/model/instruction'
import { instructionMockRecords } from './instructions-data'

function copyInstruction(instruction: Instruction): Instruction {
  return { ...instruction }
}

let instructions = instructionMockRecords.map(copyInstruction)

export function readInstructions(): Instruction[] {
  return instructions.map(copyInstruction)
}

export function updateInstruction(
  id: string,
  update: Pick<Instruction, 'active'> | Pick<Instruction, 'archived'>,
): Instruction | undefined {
  const index = instructions.findIndex(
    (instruction) => instruction.id === id && !instruction.archived,
  )

  if (index === -1) return undefined

  const updated = { ...instructions[index], ...update } as Instruction
  instructions[index] = updated
  return copyInstruction(updated)
}

export function resetInstructionsStore(): void {
  instructions = instructionMockRecords.map(copyInstruction)
}
