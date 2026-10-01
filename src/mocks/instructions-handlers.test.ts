import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { server } from './server'
import {
  instructionsHttpError,
  instructionsNetworkFailure,
} from './failure-overrides'
import { resetInstructionsStore } from './instructions-store'
import { authenticateMockAs } from './auth-store'

const apiUrl = 'http://localhost/api/instructions'

async function getInstructions(query = '') {
  return fetch(`${apiUrl}${query}`).then(async (response) => ({
    response,
    body: await response.json(),
  }))
}

async function patchInstruction(id: string, body: unknown) {
  return fetch(`${apiUrl}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (response) => ({
    response,
    body: await response.json(),
  }))
}

async function postInstruction(body: unknown) {
  return fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (response) => ({
    response,
    body: await response.json(),
  }))
}

const safeErrorSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
    code: z.string().trim().min(1).max(100),
  })
  .strict()

const createBody = {
  code: 'NEW-001',
  description: 'Nova montagem',
  url: 'https://example.test/new-001',
  active: true,
}

describe('Instructions MSW contract', () => {
  it('returns the default page directly and filters normalized terms', async () => {
    const unfiltered = await getInstructions()
    const filtered = await getInstructions('?term=%20%20FINAL%20%20')

    expect(unfiltered.response.status).toBe(200)
    expect(unfiltered.body).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 48,
      first: 1,
      last: 20,
      totalPages: 3,
    })
    expect(unfiltered.body.items).toHaveLength(20)
    expect(unfiltered.body).not.toHaveProperty('data')
    expect(filtered.body.items).toHaveLength(12)
    expect(
      filtered.body.items.every((item: { description: string }) =>
        item.description.toLocaleLowerCase('pt-BR').includes('final'),
      ),
    ).toBe(true)
  })

  it('paginates and clamps a valid page to the final available page', async () => {
    const result = await getInstructions('?page=99&pageSize=20')

    expect(result.body).toMatchObject({
      page: 3,
      pageSize: 20,
      total: 48,
      first: 41,
      last: 48,
      totalPages: 3,
    })
    expect(result.body.items).toHaveLength(8)
  })

  it.each(['0', '-1', '1.5', 'abc', '', '9007199254740992'])(
    'rejects malformed page value %j',
    async (page) => {
      const result = await getInstructions(`?page=${page}`)

      expect(result.response.status).toBe(400)
      expect(result.body).toEqual({
        message: 'Page and pageSize must be positive integers.',
        code: 'INVALID_PAGINATION',
      })
    },
  )

  it('persists an active-state update', async () => {
    authenticateMockAs('EDITOR')
    const updated = await patchInstruction('instruction-186681', {
      active: false,
    })
    const listed = await getInstructions('?term=186681')

    expect(updated.response.status).toBe(200)
    expect(updated.body).toMatchObject({
      id: 'instruction-186681',
      active: false,
    })
    expect(listed.body.items[0]).toMatchObject({ active: false })
  })

  it('persists archive updates and excludes archived records from lists', async () => {
    authenticateMockAs('ADMIN')
    const archived = await patchInstruction('instruction-186681', {
      archived: true,
    })
    const listed = await getInstructions('?term=186681')
    const repeated = await patchInstruction('instruction-186681', {
      archived: true,
    })

    expect(archived.body).toMatchObject({ archived: true })
    expect(listed.body).toMatchObject({ total: 0, first: 0, last: 0 })
    expect(repeated.response.status).toBe(404)
    expect(repeated.body).toEqual({
      message: 'Instruction not found.',
      code: 'INSTRUCTION_NOT_FOUND',
    })
  })

  it.each([
    {},
    { active: true, archived: true },
    { archived: false },
    { active: 'true' },
    { active: true, unexpected: true },
  ])('rejects invalid PATCH body %#', async (body) => {
    const result = await patchInstruction('instruction-186681', body)

    expect(result.response.status).toBe(400)
    expect(result.body).toEqual({
      message: 'Request body must select exactly one supported update.',
      code: 'INVALID_PATCH_BODY',
    })
  })

  it('returns the stable 404 payload for a missing record', async () => {
    authenticateMockAs('EDITOR')
    const result = await patchInstruction('missing', { active: true })

    expect(result.response.status).toBe(404)
    expect(result.body).toEqual({
      message: 'Instruction not found.',
      code: 'INSTRUCTION_NOT_FOUND',
    })
  })

  it('restores pristine records when the store resets', async () => {
    authenticateMockAs('EDITOR')
    await patchInstruction('instruction-186681', { active: false })
    resetInstructionsStore()
    const result = await getInstructions('?term=186681')

    expect(result.body.items[0]).toMatchObject({
      active: true,
      archived: false,
    })
  })

  it('supports a reusable network-failure override', async () => {
    server.use(instructionsNetworkFailure())

    await expect(fetch(apiUrl)).rejects.toThrow()
  })

  it('supports a reusable JSON HTTP-error override', async () => {
    server.use(
      instructionsHttpError(503, {
        message: 'Temporarily unavailable.',
        code: 'TEMPORARY_FAILURE',
      }),
    )

    const result = await getInstructions()
    expect(result.response.status).toBe(503)
    expect(result.body).toEqual({
      message: 'Temporarily unavailable.',
      code: 'TEMPORARY_FAILURE',
    })
  })

  it.each([
    ['create', () => postInstruction(createBody)],
    [
      'update',
      () =>
        patchInstruction('instruction-186681', {
          description: 'Descrição atualizada',
        }),
    ],
    [
      'set active',
      () => patchInstruction('instruction-186681', { active: false }),
    ],
    [
      'archive',
      () => patchInstruction('instruction-186681', { archived: true }),
    ],
  ])('returns a safe 401 for anonymous %s requests', async (_name, request) => {
    const result = await request()

    expect(result.response.status).toBe(401)
    expect(safeErrorSchema.parse(result.body)).toEqual({
      message: 'Authentication is required for this operation.',
      code: 'AUTHENTICATION_REQUIRED',
    })
  })

  it('allows editor writes except archive, which returns a safe 403', async () => {
    authenticateMockAs('EDITOR')

    expect((await postInstruction(createBody)).response.status).toBe(201)
    expect(
      (
        await patchInstruction('instruction-186681', {
          description: 'Descrição atualizada',
        })
      ).response.status,
    ).toBe(200)
    expect(
      (await patchInstruction('instruction-186681', { active: false })).response
        .status,
    ).toBe(200)

    const archived = await patchInstruction('instruction-186681', {
      archived: true,
    })
    expect(archived.response.status).toBe(403)
    expect(safeErrorSchema.parse(archived.body)).toEqual({
      message: 'Permission is required for this operation.',
      code: 'FORBIDDEN',
    })
  })

  it('allows administrators to create, update, set active, and archive', async () => {
    authenticateMockAs('ADMIN')

    const created = await postInstruction(createBody)
    const updated = await patchInstruction('instruction-186681', {
      description: 'Descrição administrativa',
    })
    const activated = await patchInstruction('instruction-186682', {
      active: true,
    })
    const archived = await patchInstruction('instruction-186683', {
      archived: true,
    })

    expect(created.response.status).toBe(201)
    expect(created.body).toMatchObject({ ...createBody, archived: false })
    expect(updated.response.status).toBe(200)
    expect(updated.body).toMatchObject({
      description: 'Descrição administrativa',
    })
    expect(activated.response.status).toBe(200)
    expect(activated.body).toMatchObject({ active: true })
    expect(archived.response.status).toBe(200)
    expect(archived.body).toMatchObject({ archived: true })
  })
})
