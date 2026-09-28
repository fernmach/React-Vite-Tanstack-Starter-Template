import {
  access,
  link,
  lstat,
  mkdir,
  realpath,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { renderMutation, renderQuery } from './templates'

export type ApiOperationKind = 'query' | 'mutation'

export type ApiGeneratorOptions = {
  feature: string
  kind: ApiOperationKind
  name: string
  resource: string
  dryRun: boolean
}

export type GeneratedFile = {
  absolutePath: string
  relativePath: string
  content: string
}

export type ApiGenerationPlan = {
  apiDirectory: string
  files: [GeneratedFile, GeneratedFile]
  options: ApiGeneratorOptions
  root: string
}

const VALUE_OPTIONS = new Set(['--feature', '--kind', '--name', '--resource'])
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

export class ApiGeneratorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiGeneratorError'
  }
}

function assertSafeKebabCase(option: string, value: string) {
  if (
    value.includes('..') ||
    value.includes('/') ||
    value.includes('\\') ||
    path.isAbsolute(value)
  ) {
    throw new ApiGeneratorError(
      `${option} must not contain path traversal or path separators.`,
    )
  }

  if (!KEBAB_CASE.test(value)) {
    throw new ApiGeneratorError(
      `${option} must use lowercase kebab-case (letters and digits, with single hyphens between segments).`,
    )
  }
}

export function parseApiGeneratorArgs(
  args: readonly string[],
): ApiGeneratorOptions {
  const values = new Map<string, string>()
  let dryRun = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--dry-run') {
      if (dryRun) {
        throw new ApiGeneratorError('--dry-run may be provided only once.')
      }
      dryRun = true
      continue
    }

    if (!argument?.startsWith('--')) {
      throw new ApiGeneratorError(
        `Unexpected positional argument: ${JSON.stringify(argument)}.`,
      )
    }

    if (!VALUE_OPTIONS.has(argument)) {
      throw new ApiGeneratorError(`Unknown option: ${argument}.`)
    }

    if (values.has(argument)) {
      throw new ApiGeneratorError(`${argument} may be provided only once.`)
    }

    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new ApiGeneratorError(`${argument} requires a value.`)
    }

    values.set(argument, value)
    index += 1
  }

  for (const option of VALUE_OPTIONS) {
    if (!values.has(option)) {
      throw new ApiGeneratorError(`Missing required option: ${option}.`)
    }
  }

  const feature = values.get('--feature')!
  const kind = values.get('--kind')!
  const name = values.get('--name')!
  const resource = values.get('--resource')!

  if (kind !== 'query' && kind !== 'mutation') {
    throw new ApiGeneratorError('--kind must be either query or mutation.')
  }

  assertSafeKebabCase('--feature', feature)
  assertSafeKebabCase('--name', name)
  assertSafeKebabCase('--resource', resource)

  return { feature, kind, name, resource, dryRun }
}

function isWithin(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

async function pathExists(target: string) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function assertDirectory(target: string, description: string) {
  try {
    const stats = await lstat(target)
    if (!stats.isDirectory() && !stats.isSymbolicLink()) {
      throw new ApiGeneratorError(
        `${description} is not a directory: ${target}`,
      )
    }
  } catch (error) {
    if (error instanceof ApiGeneratorError) throw error
    throw new ApiGeneratorError(`${description} does not exist: ${target}`)
  }
}

async function formatTypeScript(source: string, root: string) {
  const filepath = path.join(root, 'scaffold.tsx')
  const repositoryConfig = (await resolveConfig(filepath)) ?? {}
  return format(source, {
    ...repositoryConfig,
    filepath,
    parser: 'typescript',
  })
}

function toPortablePath(root: string, target: string) {
  return path.relative(root, target).split(path.sep).join('/')
}

export async function createApiGenerationPlan(
  rootInput: string,
  options: ApiGeneratorOptions,
): Promise<ApiGenerationPlan> {
  const root = path.resolve(rootInput)
  const featuresDirectory = path.join(root, 'src', 'features')
  const featureDirectory = path.join(featuresDirectory, options.feature)
  const apiDirectory = path.join(featureDirectory, 'api')

  await assertDirectory(featuresDirectory, 'Features directory')
  await assertDirectory(featureDirectory, `Feature "${options.feature}"`)

  const realFeaturesDirectory = await realpath(featuresDirectory)
  const realFeatureDirectory = await realpath(featureDirectory)
  if (!isWithin(realFeaturesDirectory, realFeatureDirectory)) {
    throw new ApiGeneratorError(
      `Feature "${options.feature}" resolves outside src/features.`,
    )
  }

  if (await pathExists(apiDirectory)) {
    await assertDirectory(apiDirectory, 'Feature API path')
    const realApiDirectory = await realpath(apiDirectory)
    if (!isWithin(realFeatureDirectory, realApiDirectory)) {
      throw new ApiGeneratorError(
        'The feature API directory resolves outside the feature.',
      )
    }
  }

  const operationPath = path.join(apiDirectory, `${options.name}.ts`)
  const testPath = path.join(apiDirectory, `${options.name}.test.tsx`)
  for (const target of [operationPath, testPath]) {
    if (!isWithin(featureDirectory, target)) {
      throw new ApiGeneratorError(
        `Generated target escapes the feature: ${target}`,
      )
    }
    if (await pathExists(target)) {
      throw new ApiGeneratorError(
        `Refusing to overwrite existing file: ${toPortablePath(root, target)}`,
      )
    }
  }

  const rendered =
    options.kind === 'query' ? renderQuery(options) : renderMutation(options)
  const operationContent = await formatTypeScript(rendered.operation, root)
  const testContent = await formatTypeScript(rendered.test, root)

  return {
    root,
    apiDirectory,
    options,
    files: [
      {
        absolutePath: operationPath,
        relativePath: toPortablePath(root, operationPath),
        content: operationContent,
      },
      {
        absolutePath: testPath,
        relativePath: toPortablePath(root, testPath),
        content: testContent,
      },
    ],
  }
}

export function renderDryRun(plan: ApiGenerationPlan) {
  return [
    'Dry run: no files were written.',
    ...plan.files.flatMap((file) => [
      `--- ${file.relativePath}`,
      file.content.trimEnd(),
    ]),
  ].join('\n')
}

async function removeIfPresent(target: string) {
  try {
    await unlink(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export async function writeApiGenerationPlan(plan: ApiGenerationPlan) {
  const apiDirectoryAlreadyExisted = await pathExists(plan.apiDirectory)
  await mkdir(plan.apiDirectory, { recursive: true })

  const nonce = `${process.pid}-${Date.now()}`
  const temporaryPaths = plan.files.map((file, index) =>
    path.join(
      plan.apiDirectory,
      `.${path.basename(file.absolutePath)}.${nonce}-${index}.tmp`,
    ),
  ) as [string, string]
  const createdTargets: string[] = []

  try {
    await writeFile(temporaryPaths[0], plan.files[0].content, { flag: 'wx' })
    await writeFile(temporaryPaths[1], plan.files[1].content, { flag: 'wx' })

    for (const file of plan.files) {
      if (await pathExists(file.absolutePath)) {
        throw new ApiGeneratorError(
          `Refusing to overwrite existing file: ${file.relativePath}`,
        )
      }
    }

    for (let index = 0; index < plan.files.length; index += 1) {
      await link(temporaryPaths[index], plan.files[index].absolutePath)
      createdTargets.push(plan.files[index].absolutePath)
    }
  } catch (error) {
    await Promise.all(createdTargets.map(removeIfPresent))
    if (error instanceof ApiGeneratorError) throw error
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new ApiGeneratorError(
        'Refusing to overwrite a file created concurrently.',
      )
    }
    throw error
  } finally {
    await Promise.all(temporaryPaths.map(removeIfPresent))
    if (!apiDirectoryAlreadyExisted) {
      try {
        await rm(plan.apiDirectory, { recursive: false })
      } catch {
        // The directory contains the successful output or another writer's file.
      }
    }
  }
}

export function renderSuccess(plan: ApiGenerationPlan) {
  return [
    'Created API scaffold:',
    ...plan.files.map((file) => `- ${file.relativePath}`),
    'Next: resolve every API_GENERATOR_TODO, replace the test todos with MSW coverage, and run bun run verify before committing.',
  ].join('\n')
}
