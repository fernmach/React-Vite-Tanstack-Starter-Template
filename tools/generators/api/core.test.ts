import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runApiGeneratorCli } from './cli'
import {
  ApiGeneratorError,
  createApiGenerationPlan,
  parseApiGeneratorArgs,
  renderDryRun,
  writeApiGenerationPlan,
  type ApiGeneratorOptions,
} from './core'

const temporaryRoots: string[] = []
const temporaryPrefix = 'api-generator-test-'

async function createFixture(feature = 'catalog') {
  const root = await mkdtemp(path.join(os.tmpdir(), temporaryPrefix))
  temporaryRoots.push(root)
  await mkdir(path.join(root, 'src', 'features', feature), { recursive: true })
  await writeFile(
    path.join(root, '.prettierrc'),
    JSON.stringify({ semi: false, singleQuote: true, trailingComma: 'all' }),
  )
  return root
}

function options(
  overrides: Partial<ApiGeneratorOptions> = {},
): ApiGeneratorOptions {
  return {
    feature: 'catalog',
    kind: 'query',
    name: 'get-products',
    resource: 'products',
    dryRun: false,
    ...overrides,
  }
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    expect(path.basename(root).startsWith(temporaryPrefix)).toBe(true)
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()))
    await rm(root, { recursive: true, force: true })
  }
})

describe('parseApiGeneratorArgs', () => {
  const valid = [
    '--feature',
    'catalog',
    '--kind',
    'query',
    '--name',
    'get-products',
    '--resource',
    'products',
  ]

  it('parses the exact supported interface and optional dry run', () => {
    expect(parseApiGeneratorArgs([...valid, '--dry-run'])).toEqual({
      feature: 'catalog',
      kind: 'query',
      name: 'get-products',
      resource: 'products',
      dryRun: true,
    })
  })

  it.each([
    {
      args: valid.slice(0, -2),
      message: 'Missing required option: --resource',
    },
    {
      args: [...valid, '--feature', 'other'],
      message: '--feature may be provided only once',
    },
    { args: [...valid, '--wat'], message: 'Unknown option: --wat' },
    { args: [...valid, 'extra'], message: 'Unexpected positional argument' },
  ])(
    'rejects missing, duplicate, unknown, and positional arguments',
    ({ args, message }) => {
      expect(() => parseApiGeneratorArgs(args)).toThrow(message)
    },
  )

  it('rejects invalid kinds and lowercase kebab-case values', () => {
    expect(() => parseApiGeneratorArgs(valid.with(3, 'command'))).toThrow(
      '--kind must be either query or mutation',
    )
    expect(() =>
      parseApiGeneratorArgs(valid.with(1, 'ProductCatalog')),
    ).toThrow('--feature must use lowercase kebab-case')
    expect(() => parseApiGeneratorArgs(valid.with(5, 'get_products'))).toThrow(
      '--name must use lowercase kebab-case',
    )
  })

  it.each(['../catalog', 'catalog/other', 'catalog\\other', '..'])(
    'rejects path traversal value %s',
    (feature) => {
      expect(() => parseApiGeneratorArgs(valid.with(1, feature))).toThrow(
        '--feature must not contain path traversal or path separators',
      )
    },
  )
})

describe('API generation plans', () => {
  it('renders deterministic query paths, content, formatting, and sentinels', async () => {
    const firstRoot = await createFixture()
    const secondRoot = await createFixture()
    const first = await createApiGenerationPlan(firstRoot, options())
    const second = await createApiGenerationPlan(secondRoot, options())

    expect(first.files.map((file) => file.relativePath)).toEqual([
      'src/features/catalog/api/get-products.ts',
      'src/features/catalog/api/get-products.test.tsx',
    ])
    expect(first.files.map((file) => file.content)).toEqual(
      second.files.map((file) => file.content),
    )

    const operation = first.files[0].content
    expect(operation).toContain("from '@/lib/api-client'")
    expect(operation).toContain('z.object({}).strict()')
    expect(operation).toContain('queryOptions({')
    expect(operation).toContain(
      'queryFn: ({ signal }) => requestGetProducts(normalized, signal)',
    )
    expect(operation).toContain('    signal,')
    expect(operation).toContain("validationPhase: 'request'")
    expect(operation).toContain('requestContractErrors: []')
    expect(operation).toContain('placeholderData: keepPreviousData')
    expect(operation).toContain("all: ['products'] as const")
    expect(operation).toContain('list: (input: NormalizedGetProductsInput)')
    expect(operation.indexOf('...queryConfig')).toBeLessThan(
      operation.indexOf('...options'),
    )
    expect(operation).not.toContain(';\n')
    expect(operation.match(/API_GENERATOR_TODO/g)).toHaveLength(6)
    expect(first.files[1].content.match(/API_GENERATOR_TODO/g)).toHaveLength(6)
  })

  it('renders mutation schemas, fetcher, non-overridable invalidation, callbacks, and sentinels', async () => {
    const root = await createFixture()
    const plan = await createApiGenerationPlan(
      root,
      options({ kind: 'mutation', name: 'create-product' }),
    )
    const operation = plan.files[0].content

    expect(operation).toContain(
      'createProductInputSchema = z.object({}).strict()',
    )
    expect(operation).toContain(
      'createProductResponseSchema = z.object({}).strict()',
    )
    expect(operation).toContain("apiClient.post('/products'")
    expect(operation.indexOf('...restConfig')).toBeLessThan(
      operation.indexOf('mutationFn: createProduct'),
    )
    expect(operation).toContain('Promise.allSettled([')
    expect(operation).toContain('queryClient.invalidateQueries(')
    expect(operation).toContain('{ throwOnError: true }')
    expect(operation).toContain('errorReporting.report(outcome.reason')
    expect(operation).toContain(
      "notifyFollowUpError(index === 0 ? 'refresh' : 'callback')",
    )
    expect(operation).toContain(
      'onSuccess?.(data, variables, context, mutationContext)',
    )
    expect(operation.match(/API_GENERATOR_TODO/g)).toHaveLength(7)
    expect(plan.files[1].content.match(/API_GENERATOR_TODO/g)).toHaveLength(5)
  })

  it('fails when the feature does not exist', async () => {
    const root = await createFixture()
    await expect(
      createApiGenerationPlan(root, options({ feature: 'missing' })),
    ).rejects.toThrow('Feature "missing" does not exist')
  })

  it('performs a dry run with deterministic previews and zero writes', async () => {
    const root = await createFixture()
    const stdout: string[] = []
    const stderr: string[] = []
    const exitCode = await runApiGeneratorCli(
      [
        '--feature',
        'catalog',
        '--kind',
        'query',
        '--name',
        'get-products',
        '--resource',
        'products',
        '--dry-run',
      ],
      root,
      {
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message),
      },
    )

    expect(exitCode).toBe(0)
    expect(stderr).toEqual([])
    expect(stdout[0]).toBe(
      renderDryRun(
        await createApiGenerationPlan(root, options({ dryRun: true })),
      ),
    )
    await expect(
      readdir(path.join(root, 'src', 'features', 'catalog')),
    ).resolves.toEqual([])
  })

  it('returns a non-zero CLI result for invalid arguments', async () => {
    const root = await createFixture()
    const errors: string[] = []
    const exitCode = await runApiGeneratorCli([], root, {
      stdout: () => undefined,
      stderr: (message) => errors.push(message),
    })

    expect(exitCode).toBe(1)
    expect(errors[0]).toContain('Missing required option: --feature')
  })
})

describe('safe writes', () => {
  it('writes exactly the operation and colocated test without a barrel', async () => {
    const root = await createFixture()
    const plan = await createApiGenerationPlan(root, options())
    await writeApiGenerationPlan(plan)

    await expect(readFile(plan.files[0].absolutePath, 'utf8')).resolves.toBe(
      plan.files[0].content,
    )
    await expect(readFile(plan.files[1].absolutePath, 'utf8')).resolves.toBe(
      plan.files[1].content,
    )
    await expect(readdir(plan.apiDirectory)).resolves.toEqual([
      'get-products.test.tsx',
      'get-products.ts',
    ])
  })

  it('rejects operation and test collisions during planning', async () => {
    const root = await createFixture()
    const apiDirectory = path.join(root, 'src', 'features', 'catalog', 'api')
    await mkdir(apiDirectory)
    await writeFile(
      path.join(apiDirectory, 'get-products.ts'),
      'owned operation',
    )
    await expect(createApiGenerationPlan(root, options())).rejects.toThrow(
      'Refusing to overwrite existing file: src/features/catalog/api/get-products.ts',
    )

    await rm(path.join(apiDirectory, 'get-products.ts'))
    await writeFile(
      path.join(apiDirectory, 'get-products.test.tsx'),
      'owned test',
    )
    await expect(createApiGenerationPlan(root, options())).rejects.toThrow(
      'Refusing to overwrite existing file: src/features/catalog/api/get-products.test.tsx',
    )
  })

  it('refuses a post-plan collision without overwriting or partially writing', async () => {
    const root = await createFixture()
    const plan = await createApiGenerationPlan(root, options())
    await mkdir(plan.apiDirectory)
    await writeFile(plan.files[0].absolutePath, 'concurrent owner')

    await expect(writeApiGenerationPlan(plan)).rejects.toBeInstanceOf(
      ApiGeneratorError,
    )
    await expect(readFile(plan.files[0].absolutePath, 'utf8')).resolves.toBe(
      'concurrent owner',
    )
    await expect(readFile(plan.files[1].absolutePath, 'utf8')).rejects.toThrow()
    await expect(readdir(plan.apiDirectory)).resolves.toEqual([
      'get-products.ts',
    ])
  })
})
