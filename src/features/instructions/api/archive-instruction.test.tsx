import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { Instruction } from '../model/instruction'
import { instructionsUrl } from '@/mocks/instructions-handlers'
import { server } from '@/mocks/server'
import { act, renderHook } from '@/test/render'
import {
  archiveInstruction,
  useArchiveInstruction,
} from './archive-instruction'
import { instructionKeys } from './instruction-keys'

const instruction: Instruction = {
  id: 'instruction/archive',
  code: '200',
  description: 'Inspeção',
  url: 'https://example.com/instructions/200',
  active: true,
  archived: false,
}

describe('archiveInstruction', () => {
  it('PATCHes the encoded id with exactly archived true and validates responses', async () => {
    await expect(archiveInstruction({ id: ' ' })).rejects.toMatchObject({
      kind: 'validation',
    })

    let requestPath = ''
    let requestBody: unknown
    server.use(
      http.patch(`${instructionsUrl}/*`, async ({ request }) => {
        requestPath = new URL(request.url).pathname
        requestBody = await request.json()
        return HttpResponse.json({ ...instruction, archived: true })
      }),
    )

    await expect(
      archiveInstruction({ id: instruction.id }),
    ).resolves.toMatchObject({ archived: true })
    expect(requestPath).toContain('/instructions/instruction%2Farchive')
    expect(requestBody).toEqual({ archived: true })

    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json({ ...instruction, archived: true, unexpected: true }),
      ),
    )
    await expect(
      archiveInstruction({ id: instruction.id }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  it('invalidates every list after success and composes the consumer callback', async () => {
    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json({ ...instruction, archived: true }),
      ),
    )
    const onSuccess = vi.fn()
    const { queryClient, result } = renderHook(() =>
      useArchiveInstruction({ mutationConfig: { onSuccess } }),
    )
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await act(() => result.current.mutateAsync({ id: instruction.id }))

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: instructionKeys.lists(),
    })
    expect(onSuccess).toHaveBeenCalledOnce()
  })
})
