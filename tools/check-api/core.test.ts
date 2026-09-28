import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { allowedFixture, forbiddenFixture } from './fixtures'
import {
  formatApiArchitectureDiagnostics,
  inspectApiArchitecture,
} from './core'

const roots: string[] = []

async function createFixture(files: Record<string, string>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'check-api-test-'))
  roots.push(root)
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }
  return root
}

afterEach(async () => {
  for (const root of roots.splice(0)) {
    expect(path.basename(root).startsWith('check-api-test-')).toBe(true)
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()))
    await rm(root, { recursive: true, force: true })
  }
})

describe('API architecture inspection', () => {
  it('accepts shared-client operations and hook/type-only consumers', async () => {
    const root = await createFixture(allowedFixture)
    await expect(inspectApiArchitecture(root)).resolves.toEqual([])
  })

  it('reports deliberate operation, consumer, sentinel, and provider violations', async () => {
    const root = await createFixture(forbiddenFixture)
    const diagnostics = await inspectApiArchitecture(root)
    const codes = diagnostics.map((diagnostic) => diagnostic.code)

    expect(codes).toEqual(
      expect.arrayContaining([
        'API_GENERATOR_TODO',
        'API_OPERATION_HOOK',
        'API_OPERATION_SCHEMA',
        'API_QUERY_PROVIDER',
        'API_SHARED_CLIENT',
        'API_UI_FETCHER_IMPORT',
      ]),
    )
    expect(formatApiArchitectureDiagnostics(diagnostics)).toContain(
      'src/features/catalog/pages/products-page.tsx:2 [API_UI_FETCHER_IMPORT]',
    )
    expect(formatApiArchitectureDiagnostics(diagnostics)).toContain(
      'may import only use* hooks or type-only symbols',
    )
  })

  it('requires the hook that matches the operation kind', async () => {
    const root = await createFixture({
      ...allowedFixture,
      'src/features/catalog/api/create-product.ts': `
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
export const createProductSchema = {}
export async function createProduct() { return apiClient.post('/products', { responseSchema: {} as never }) }
export function useCreateProduct() { return null }
void useMutation
`,
    })
    const diagnostics = await inspectApiArchitecture(root)

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'API_OPERATION_HOOK',
        file: 'src/features/catalog/api/create-product.ts',
      }),
    ])
  })
})
