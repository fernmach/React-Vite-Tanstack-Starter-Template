import {
  inspectApiArchitecture,
  formatApiArchitectureDiagnostics,
} from './core'

export async function runApiArchitectureCheck(
  root = process.cwd(),
  write: (message: string) => void = console.log,
) {
  const diagnostics = await inspectApiArchitecture(root)
  write(formatApiArchitectureDiagnostics(diagnostics))
  return diagnostics.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exitCode = await runApiArchitectureCheck()
}
