import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export type ProductionArtifactDiagnostic = {
  code: 'FORBIDDEN_FILE' | 'FORBIDDEN_CONTENT' | 'MISSING_OUTPUT'
  file: string
  message: string
}

const forbiddenFileNames = new Set(['mockServiceWorker.js'])

const forbiddenContent: readonly { label: string; value: string }[] = [
  { label: 'MSW browser runtime', value: 'Mock Service Worker' },
  { label: 'MSW package/runtime', value: 'setupWorker' },
  { label: 'editor mock account', value: 'editor@taskdesk.test' },
  { label: 'administrator mock account', value: 'admin@taskdesk.test' },
  { label: 'editor mock password', value: 'Editor-Test-Password' },
  { label: 'administrator mock password', value: 'Admin-Test-Password' },
  { label: 'mock CSRF token prefix', value: 'mock-csrf-' },
  { label: 'TanStack Query development tools', value: 'ReactQueryDevtools' },
  {
    label: 'TanStack Router development tools',
    value: 'TanStackRouterDevtools',
  },
]

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name)
      return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath]
    }),
  )
  return nested.flat().sort()
}

export async function inspectProductionArtifacts(
  root: string,
): Promise<ProductionArtifactDiagnostic[]> {
  const outputDirectory = path.join(root, 'dist')
  let files: string[]
  try {
    files = await collectFiles(outputDirectory)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return [
        {
          code: 'MISSING_OUTPUT',
          file: 'dist',
          message:
            'Production output is missing; run the production build first.',
        },
      ]
    }
    throw error
  }

  const diagnostics: ProductionArtifactDiagnostic[] = []
  for (const absolutePath of files) {
    const relativePath = path.relative(root, absolutePath).replaceAll('\\', '/')
    if (forbiddenFileNames.has(path.basename(absolutePath))) {
      diagnostics.push({
        code: 'FORBIDDEN_FILE',
        file: relativePath,
        message: 'Development-only service worker was emitted.',
      })
      continue
    }

    const content = await readFile(absolutePath)
    for (const forbidden of forbiddenContent) {
      if (!content.includes(Buffer.from(forbidden.value))) continue
      diagnostics.push({
        code: 'FORBIDDEN_CONTENT',
        file: relativePath,
        message: `Production output contains ${forbidden.label}.`,
      })
    }
  }
  return diagnostics
}

export function formatProductionArtifactDiagnostics(
  diagnostics: readonly ProductionArtifactDiagnostic[],
) {
  if (diagnostics.length === 0)
    return 'Production artifact security check passed.'
  return diagnostics
    .map(
      (diagnostic) =>
        `${diagnostic.file} [${diagnostic.code}] ${diagnostic.message}`,
    )
    .join('\n')
}
