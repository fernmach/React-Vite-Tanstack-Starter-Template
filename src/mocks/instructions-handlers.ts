import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { env } from '@/config/env'
import type { InstructionPage } from '@/features/instructions/model/instruction'
import { readInstructions, updateInstruction } from './instructions-store'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_TERM_LENGTH = 200

const patchBodySchema = z.union([
  z.object({ active: z.boolean() }).strict(),
  z.object({ archived: z.literal(true) }).strict(),
])

const apiBaseUrl = env.API_URL.replace(/\/$/, '')

export const instructionsUrl = `*${apiBaseUrl}/instructions`

function errorResponse(status: number, message: string, code: string) {
  return HttpResponse.json({ message, code }, { status })
}

function parsePositiveInteger(
  searchParams: URLSearchParams,
  name: 'page' | 'pageSize',
  defaultValue: number,
): number | undefined {
  const rawValue = searchParams.get(name)
  if (rawValue === null) return defaultValue
  if (!/^\d+$/.test(rawValue)) return undefined

  const value = Number(rawValue)
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

export const instructionsHandlers = [
  http.get(instructionsUrl, ({ request }) => {
    const url = new URL(request.url)
    const page = parsePositiveInteger(url.searchParams, 'page', DEFAULT_PAGE)
    const pageSize = parsePositiveInteger(
      url.searchParams,
      'pageSize',
      DEFAULT_PAGE_SIZE,
    )

    if (page === undefined || pageSize === undefined) {
      return errorResponse(
        400,
        'Page and pageSize must be positive integers.',
        'INVALID_PAGINATION',
      )
    }

    const term = (url.searchParams.get('term') ?? '')
      .trim()
      .slice(0, MAX_TERM_LENGTH)
    const needle = term.toLocaleLowerCase('pt-BR')
    const filtered = readInstructions().filter(
      (instruction) =>
        !instruction.archived &&
        (!needle ||
          instruction.code.toLocaleLowerCase('pt-BR').includes(needle) ||
          instruction.description.toLocaleLowerCase('pt-BR').includes(needle)),
    )
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const clampedPage = Math.min(page, totalPages)
    const start = (clampedPage - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    const response: InstructionPage = {
      items,
      page: clampedPage,
      pageSize,
      total: filtered.length,
      first: items.length === 0 ? 0 : start + 1,
      last: items.length === 0 ? 0 : start + items.length,
      totalPages,
    }

    return HttpResponse.json(response)
  }),

  http.patch(`${instructionsUrl}/:id`, async ({ params, request }) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse(
        400,
        'Request body must select exactly one supported update.',
        'INVALID_PATCH_BODY',
      )
    }

    const parsedBody = patchBodySchema.safeParse(body)
    if (!parsedBody.success) {
      return errorResponse(
        400,
        'Request body must select exactly one supported update.',
        'INVALID_PATCH_BODY',
      )
    }

    const id = Array.isArray(params.id) ? params.id[0] : params.id
    const updated = id
      ? updateInstruction(decodeURIComponent(id), parsedBody.data)
      : undefined

    if (!updated) {
      return errorResponse(
        404,
        'Instruction not found.',
        'INSTRUCTION_NOT_FOUND',
      )
    }

    return HttpResponse.json(updated)
  }),
]
