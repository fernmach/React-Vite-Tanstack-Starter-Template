import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ApiGeneratorError,
  createApiGenerationPlan,
  parseApiGeneratorArgs,
  renderDryRun,
  renderSuccess,
  writeApiGenerationPlan,
} from './core'

type CliIo = {
  stdout: (message: string) => void
  stderr: (message: string) => void
}

export async function runApiGeneratorCli(
  args: readonly string[],
  root: string,
  io: CliIo,
) {
  try {
    const options = parseApiGeneratorArgs(args)
    const plan = await createApiGenerationPlan(root, options)

    if (options.dryRun) {
      io.stdout(renderDryRun(plan))
      return 0
    }

    await writeApiGenerationPlan(plan)
    io.stdout(renderSuccess(plan))
    return 0
  } catch (error) {
    const message =
      error instanceof ApiGeneratorError || error instanceof Error
        ? error.message
        : 'Unknown generator failure.'
    io.stderr(`generate:api failed: ${message}`)
    return 1
  }
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntrypoint) {
  const exitCode = await runApiGeneratorCli(
    process.argv.slice(2),
    process.cwd(),
    {
      stdout: console.log,
      stderr: console.error,
    },
  )
  process.exitCode = exitCode
}
