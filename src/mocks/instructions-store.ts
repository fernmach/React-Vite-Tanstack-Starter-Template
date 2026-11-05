import type { Instruction } from '@/features/instructions/model/instruction'
import { instructionMockRecords } from './instructions-data'

function copyInstruction(instruction: Instruction): Instruction {
  return { ...instruction }
}

let instructions = instructionMockRecords.map(copyInstruction)
let createdInstructionSequence = 0

export function readInstructions(): Instruction[] {
  return instructions.map(copyInstruction)
}

export function updateInstruction(
  id: string,
  update: Partial<
    Pick<Instruction, 'code' | 'description' | 'url' | 'active' | 'archived'>
  >,
): Instruction | undefined {
  const index = instructions.findIndex(
    (instruction) => instruction.id === id && !instruction.archived,
  )

  if (index === -1) return undefined

  const updated = { ...instructions[index], ...update } as Instruction
  instructions[index] = updated
  return copyInstruction(updated)
}

export function createInstruction(
  input: Pick<Instruction, 'code' | 'description' | 'url' | 'active'>,
): Instruction {
  createdInstructionSequence += 1
  const instruction: Instruction = {
    ...input,
    id: `instruction-created-${createdInstructionSequence}`,
    archived: false,
  }
  instructions.push(instruction)
  return copyInstruction(instruction)
}

export function resetInstructionsStore(): void {
  instructions = instructionMockRecords.map(copyInstruction)
  createdInstructionSequence = 0
}
