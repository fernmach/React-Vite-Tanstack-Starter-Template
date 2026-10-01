import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  formatProductionArtifactDiagnostics,
  inspectProductionArtifacts,
} from './core'

const roots: string[] = []

async function createOutput(files: Record<string, string>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'production-check-test-'))
  roots.push(root)
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, 'dist', relativePath)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }
  return root
}

afterEach(async () => {
  for (const root of roots.splice(0)) {
    expect(path.basename(root).startsWith('production-check-test-')).toBe(true)
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()))
    await rm(root, { recursive: true, force: true })
  }
})

describe('production artifact inspection', () => {
  it('accepts ordinary production assets', async () => {
    const root = await createOutput({
      'index.html': '<script type="module" src="/assets/app.js"></script>',
      'assets/app.js': 'console.info("application")',
    })
    await expect(inspectProductionArtifacts(root)).resolves.toEqual([])
  })

  it('rejects the worker, deterministic credentials, and development tools', async () => {
    const root = await createOutput({
      'mockServiceWorker.js': 'Mock Service Worker',
      'assets/mock.js': 'editor@taskdesk.test Editor-Test-Password mock-csrf-',
      'assets/devtools.js': 'ReactQueryDevtools TanStackRouterDevtools',
    })
    const diagnostics = await inspectProductionArtifacts(root)

    expect(diagnostics.map(({ code }) => code)).toContain('FORBIDDEN_FILE')
    expect(
      diagnostics.filter(({ code }) => code === 'FORBIDDEN_CONTENT'),
    ).toHaveLength(5)
    expect(formatProductionArtifactDiagnostics(diagnostics)).toContain(
      'editor mock account',
    )
  })

  it('fails closed when the production output is absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'production-check-test-'))
    roots.push(root)
    await expect(inspectProductionArtifacts(root)).resolves.toEqual([
      expect.objectContaining({ code: 'MISSING_OUTPUT', file: 'dist' }),
    ])
  })
})
