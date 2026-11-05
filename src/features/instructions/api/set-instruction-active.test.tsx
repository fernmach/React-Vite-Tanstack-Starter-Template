import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Instruction, InstructionPage } from '../model/instruction'
import { instructionsHttpError } from '@/mocks/failure-overrides'
import { instructionsUrl } from '@/mocks/instructions-handlers'
import { server } from '@/mocks/server'
import { authenticateMockAs } from '@/mocks/auth-store'
import { act, renderHook, waitFor } from '@/test/render'
import { instructionKeys } from './instruction-keys'
import {
  setInstructionActive,
  useSetInstructionActive,
} from './set-instruction-active'

const instruction: Instruction = {
  id: 'instruction/one',
  code: '100',
  description: 'Montagem',
  url: 'https://example.com/instructions/100',
  active: true,
  archived: false,
}

function page(items: Instruction[], pageNumber: number): InstructionPage {
  return {
    items,
    page: pageNumber,
    pageSize: 1,
    total: 2,
    first: pageNumber,
    last: pageNumber,
    totalPages: 2,
  }
}

describe('setInstructionActive', () => {
  beforeEach(() => authenticateMockAs('EDITOR'))

  it('keeps a successful write successful when refresh and consumer callbacks fail', async () => {
    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json({ ...instruction, active: false }),
      ),
    )
    const onFollowUpError = vi.fn()
    const { queryClient, result } = renderHook(() =>
      useSetInstructionActive({
        onFollowUpError,
        mutationConfig: {
          onSuccess: () => {
            throw new Error('callback')
          },
        },
      }),
    )
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValue(
      new Error('refresh'),
    )
    await expect(
      act(() =>
        result.current.mutateAsync({ id: instruction.id, active: false }),
      ),
    ).resolves.toMatchObject({ active: false })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(onFollowUpError).toHaveBeenCalledWith('refresh')
    expect(onFollowUpError).toHaveBeenCalledWith('callback')
  })

  it('PATCHes the encoded id with exactly the active field and validates responses', async () => {
    await expect(
      setInstructionActive({ id: ' ', active: false }),
    ).rejects.toMatchObject({ kind: 'validation' })

    let requestPath = ''
    let requestBody: unknown
    server.use(
      http.patch(`${instructionsUrl}/*`, async ({ request }) => {
        requestPath = new URL(request.url).pathname
        requestBody = await request.json()
        return HttpResponse.json({ ...instruction, active: false })
      }),
    )

    await expect(
      setInstructionActive({ id: instruction.id, active: false }),
    ).resolves.toMatchObject({ active: false })
    expect(requestPath).toContain('/instructions/instruction%2Fone')
    expect(requestBody).toEqual({ active: false })

    server.use(
      http.patch(`${instructionsUrl}/*`, () =>
        HttpResponse.json({ ...instruction, active: 'false' }),
      ),
    )
    await expect(
      setInstructionActive({ id: instruction.id, active: false }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  it('optimistically updates every cached page before the request settles', async () => {
    let releaseRequest!: () => void
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    server.use(
      http.patch(`${instructionsUrl}/*`, async () => {
        await requestGate
        return HttpResponse.json({ ...instruction, active: false })
      }),
    )
    const keyOne = instructionKeys.list({ term: '', page: 1, pageSize: 1 })
    const keyTwo = instructionKeys.list({ term: '', page: 2, pageSize: 1 })
    const { queryClient, result } = renderHook(() => useSetInstructionActive())
    queryClient.setQueryData(keyOne, page([instruction], 1))
    queryClient.setQueryData(keyTwo, page([instruction], 2))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => result.current.mutate({ id: instruction.id, active: false }))

    await waitFor(() => {
      expect(
        queryClient.getQueryData<InstructionPage>(keyOne)?.items[0]?.active,
      ).toBe(false)
      expect(
        queryClient.getQueryData<InstructionPage>(keyTwo)?.items[0]?.active,
      ).toBe(false)
    })

    releaseRequest()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey: instructionKeys.lists() },
      { throwOnError: true },
    )
  })

  it('cancels lists, restores exact snapshots, invalidates, and composes callbacks on failure', async () => {
    server.use(instructionsHttpError(503, { message: 'Unavailable' }))
    const keyOne = instructionKeys.list({ term: '', page: 1, pageSize: 1 })
    const keyTwo = instructionKeys.list({ term: '100', page: 1, pageSize: 1 })
    const originalOne = page([instruction], 1)
    const originalTwo = page([{ ...instruction, description: 'Other view' }], 1)
    const consumerContext = { source: 'consumer' }
    const onMutate = vi.fn(() => consumerContext)
    const onError = vi.fn()
    const onSettled = vi.fn()
    const { queryClient, result } = renderHook(() =>
      useSetInstructionActive({
        mutationConfig: { onMutate, onError, onSettled },
      }),
    )
    queryClient.setQueryData(keyOne, originalOne)
    queryClient.setQueryData(keyTwo, originalTwo)
    const cancel = vi.spyOn(queryClient, 'cancelQueries')
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await expect(
      act(() =>
        result.current.mutateAsync({ id: instruction.id, active: false }),
      ),
    ).rejects.toMatchObject({ kind: 'http', status: 503 })

    expect(cancel).toHaveBeenCalledWith({ queryKey: instructionKeys.lists() })
    expect(queryClient.getQueryData(keyOne)).toEqual(originalOne)
    expect(queryClient.getQueryData(keyTwo)).toEqual(originalTwo)
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey: instructionKeys.lists() },
      { throwOnError: true },
    )
    expect(onMutate).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]?.[2]).toBe(consumerContext)
    expect(onSettled.mock.calls[0]?.[3]).toBe(consumerContext)
  })
})
