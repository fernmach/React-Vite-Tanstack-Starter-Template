import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

export type ApiArchitectureDiagnostic = {
  code: string
  file: string
  line: number
  message: string
}

const sourceExtension = /\.[cm]?[jt]sx?$/
const testFile = /\.test\.[cm]?[jt]sx?$/

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) return collectSourceFiles(absolutePath)
      return sourceExtension.test(entry.name) ? [absolutePath] : []
    }),
  )
  return nested.flat().sort()
}

function scriptKind(file: string) {
  return file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind) {
  return ts.canHaveModifiers(node)
    ? (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ??
        false)
    : false
}

function isExported(node: ts.Node) {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword)
}

function walk(node: ts.Node, predicate: (candidate: ts.Node) => boolean) {
  if (predicate(node)) return true
  return node.getChildren().some((child) => walk(child, predicate))
}

function callsIdentifier(node: ts.Node, name: string) {
  return walk(
    node,
    (candidate) =>
      ts.isCallExpression(candidate) &&
      ts.isIdentifier(candidate.expression) &&
      candidate.expression.text === name,
  )
}

function usesApiClient(sourceFile: ts.SourceFile) {
  return walk(
    sourceFile,
    (candidate) =>
      ts.isPropertyAccessExpression(candidate) &&
      ts.isIdentifier(candidate.expression) &&
      candidate.expression.text === 'apiClient',
  )
}

function importsName(
  sourceFile: ts.SourceFile,
  moduleName: string,
  name: string,
) {
  return sourceFile.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName
    ) {
      return false
    }
    const bindings = statement.importClause?.namedBindings
    return (
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        (element) => (element.propertyName ?? element.name).text === name,
      )
    )
  })
}

function exportsSchema(sourceFile: ts.SourceFile) {
  return sourceFile.statements.some((statement) => {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      return statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text.endsWith('Schema'),
      )
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      return (
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some((element) =>
          (element.propertyName ?? element.name).text.endsWith('Schema'),
        )
      )
    }
    return false
  })
}

function exportsAsyncFetcher(sourceFile: ts.SourceFile) {
  return sourceFile.statements.some(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      isExported(statement) &&
      hasModifier(statement, ts.SyntaxKind.AsyncKeyword) &&
      statement.name !== undefined &&
      !statement.name.text.startsWith('use'),
  )
}

function exportsHookCalling(sourceFile: ts.SourceFile, hook: string) {
  return sourceFile.statements.some(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      isExported(statement) &&
      statement.name?.text.startsWith('use') === true &&
      statement.body !== undefined &&
      callsIdentifier(statement.body, hook),
  )
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node = sourceFile) {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  )
}

function toProjectPath(root: string, file: string) {
  return path.relative(root, file).replaceAll('\\', '/')
}

function resolveImport(root: string, sourceFile: string, specifier: string) {
  if (specifier.startsWith('@/'))
    return path.join(root, 'src', specifier.slice(2))
  if (specifier.startsWith('.'))
    return path.resolve(path.dirname(sourceFile), specifier)
  return null
}

function addDiagnostic(
  diagnostics: ApiArchitectureDiagnostic[],
  root: string,
  sourceFile: ts.SourceFile,
  code: string,
  message: string,
  node?: ts.Node,
) {
  diagnostics.push({
    code,
    file: toProjectPath(root, sourceFile.fileName),
    line: lineOf(sourceFile, node),
    message,
  })
}

function inspectOperation(
  diagnostics: ApiArchitectureDiagnostic[],
  root: string,
  sourceFile: ts.SourceFile,
) {
  const hasQuery = importsName(sourceFile, '@tanstack/react-query', 'useQuery')
  const hasMutation = importsName(
    sourceFile,
    '@tanstack/react-query',
    'useMutation',
  )
  const isOperation = hasQuery || hasMutation || usesApiClient(sourceFile)
  if (!isOperation) return

  if (
    !importsName(sourceFile, '@/lib/api-client', 'apiClient') ||
    !usesApiClient(sourceFile)
  ) {
    addDiagnostic(
      diagnostics,
      root,
      sourceFile,
      'API_SHARED_CLIENT',
      'Feature API operations must import and call apiClient from @/lib/api-client.',
    )
  }
  if (!exportsSchema(sourceFile)) {
    addDiagnostic(
      diagnostics,
      root,
      sourceFile,
      'API_OPERATION_SCHEMA',
      'API operation modules must export their runtime request or response schemas.',
    )
  }
  if (!exportsAsyncFetcher(sourceFile)) {
    addDiagnostic(
      diagnostics,
      root,
      sourceFile,
      'API_OPERATION_FETCHER',
      'API operation modules must export an async endpoint fetcher.',
    )
  }
  if (hasQuery && !exportsHookCalling(sourceFile, 'useQuery')) {
    addDiagnostic(
      diagnostics,
      root,
      sourceFile,
      'API_OPERATION_HOOK',
      'Query operation modules must export a use* hook that calls useQuery.',
    )
  }
  if (hasMutation && !exportsHookCalling(sourceFile, 'useMutation')) {
    addDiagnostic(
      diagnostics,
      root,
      sourceFile,
      'API_OPERATION_HOOK',
      'Mutation operation modules must export a use* hook that calls useMutation.',
    )
  }
}

function inspectUiImports(
  diagnostics: ApiArchitectureDiagnostic[],
  root: string,
  sourceFile: ts.SourceFile,
) {
  const projectPath = toProjectPath(root, sourceFile.fileName)
  const isUiConsumer =
    /^src\/(app|routes)\//.test(projectPath) ||
    /^src\/features\/[^/]+\/(components|pages)\//.test(projectPath)
  if (!isUiConsumer) return

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue
    }
    const resolved = resolveImport(
      root,
      sourceFile.fileName,
      statement.moduleSpecifier.text,
    )
    if (!resolved || !resolved.replaceAll('\\', '/').includes('/features/'))
      continue
    if (!resolved.replaceAll('\\', '/').includes('/api/')) continue

    const clause = statement.importClause
    if (!clause || clause.isTypeOnly) continue
    const bindings = clause.namedBindings
    const forbidden =
      clause.name !== undefined ||
      bindings === undefined ||
      ts.isNamespaceImport(bindings) ||
      bindings.elements.some(
        (element) =>
          !element.isTypeOnly &&
          !(element.propertyName ?? element.name).text.startsWith('use'),
      )
    if (forbidden) {
      addDiagnostic(
        diagnostics,
        root,
        sourceFile,
        'API_UI_FETCHER_IMPORT',
        'Components, pages, routes, and app composition may import only use* hooks or type-only symbols from feature API modules.',
        statement,
      )
    }
  }
}

export async function inspectApiArchitecture(
  root: string,
): Promise<ApiArchitectureDiagnostic[]> {
  const absoluteRoot = path.resolve(root)
  const sourceRoot = path.join(absoluteRoot, 'src')
  const files = await collectSourceFiles(sourceRoot)
  const diagnostics: ApiArchitectureDiagnostic[] = []
  let hasQueryClientProvider = false

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(file),
    )
    const projectPath = toProjectPath(absoluteRoot, file)

    if (!testFile.test(file) && text.includes('API_GENERATOR_TODO')) {
      const position = text.indexOf('API_GENERATOR_TODO')
      addDiagnostic(
        diagnostics,
        absoluteRoot,
        sourceFile,
        'API_GENERATOR_TODO',
        'Resolve every API_GENERATOR_TODO before validation can pass.',
        ts.getTokenAtPosition(sourceFile, position),
      )
    }

    if (
      /^src\/features\/[^/]+\/api\//.test(projectPath) &&
      !testFile.test(file)
    ) {
      inspectOperation(diagnostics, absoluteRoot, sourceFile)
    }
    if (!testFile.test(file))
      inspectUiImports(diagnostics, absoluteRoot, sourceFile)

    if (
      walk(
        sourceFile,
        (candidate) =>
          ts.isJsxOpeningLikeElement(candidate) &&
          ts.isIdentifier(candidate.tagName) &&
          candidate.tagName.text === 'QueryClientProvider',
      )
    ) {
      hasQueryClientProvider = true
    }
  }

  if (!hasQueryClientProvider) {
    diagnostics.push({
      code: 'API_QUERY_PROVIDER',
      file: 'src',
      line: 1,
      message:
        'Application composition must render QueryClientProvider before API hooks can be used.',
    })
  }

  return diagnostics.sort((left, right) =>
    `${left.file}:${left.line}:${left.code}`.localeCompare(
      `${right.file}:${right.line}:${right.code}`,
    ),
  )
}

export function formatApiArchitectureDiagnostics(
  diagnostics: ApiArchitectureDiagnostic[],
) {
  if (diagnostics.length === 0) return 'API architecture check passed.'
  return [
    `API architecture check failed with ${diagnostics.length} violation(s):`,
    ...diagnostics.map(
      ({ file, line, code, message }) =>
        `- ${file}:${line} [${code}] ${message}`,
    ),
  ].join('\n')
}
