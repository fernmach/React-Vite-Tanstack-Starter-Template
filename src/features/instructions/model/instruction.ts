import { z } from 'zod'

export const instructionSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().min(1),
    description: z.string(),
    url: z.url(),
    active: z.boolean(),
    archived: z.boolean(),
  })
  .strict()

export type Instruction = z.infer<typeof instructionSchema>

export const instructionQuerySchema = z
  .object({
    term: z.string().trim().max(200).default(''),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(20),
  })
  .strict()

export type InstructionQuery = z.input<typeof instructionQuerySchema>
export type NormalizedInstructionQuery = z.output<typeof instructionQuerySchema>

export const instructionPageSchema = z
  .object({
    items: z.array(instructionSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    first: z.number().int().nonnegative(),
    last: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  })
  .strict()

export type InstructionPage = z.infer<typeof instructionPageSchema>
