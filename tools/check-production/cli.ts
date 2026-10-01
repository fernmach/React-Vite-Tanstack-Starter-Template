import {
  formatProductionArtifactDiagnostics,
  inspectProductionArtifacts,
} from './core'

export async function runProductionArtifactCheck(
  root = process.cwd(),
  write: (message: string) => void = console.log,
) {
  const diagnostics = await inspectProductionArtifacts(root)
  write(formatProductionArtifactDiagnostics(diagnostics))
  return diagnostics.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exitCode = await runProductionArtifactCheck()
}
