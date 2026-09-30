# API Layer

This document is the canonical API-layer standard for this repository. It
adopts the principles in the
[Bulletproof React API Layer guide](https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md):
use one configured API client and colocate each request's runtime schemas,
fetcher, and TanStack Query hook. The repository makes the choices below more
specific so implementations and reviews have one unambiguous contract.

> **Migration status:** complete. The shared environment, Axios/Zod client,
> error model, TanStack Query provider, test infrastructure, MSW development/test
> backend, Instructions request declarations, migrated UI, deterministic API
> generator, and architecture enforcement are implemented. Enforcement runs
> through ESLint, `bun run check:api`, pre-commit validation, and CI.
> The complementary [error-handling standard](error-handling.md) defines
> classification, feedback, reporting, cancellation, and recovery ownership.

## Reading the rules

- **MUST**, **MUST NOT**, and **REQUIRED** are acceptance requirements.
- **SHOULD** is the default; a deviation needs a concrete reason in review.
- **MAY** and **OPTIONAL** describe choices that can vary without violating the
  architecture.

## Adopted architecture

The application uses these fixed boundaries:

1. A single shared Axios-backed `apiClient` is the only HTTP transport.
2. Data received over HTTP remains `unknown` until a supplied Zod schema parses
   it.
3. Every endpoint is a separate feature-owned request declaration containing
   its request and response schemas, typed fetcher, TanStack Query options or
   mutation hook, and explicit cache behavior.
4. TanStack Query owns remote/server state. Components do not duplicate it in
   effects or component-local repositories.
5. UI consumers use feature hooks and domain types only.

Components and pages **MUST NOT** call Axios, `fetch`, `apiClient`, or endpoint
fetchers. Routes and app composition follow the same restriction. They may
import request-derived types and feature hooks such as `useInstructions`,
`useSetInstructionActive`, and `useArchiveInstruction`.

## Folder placement

The target placement is:

```text
src/
├── app/
│   └── provider.tsx                    # QueryClientProvider composition
├── config/
│   └── env.ts                          # the only import.meta.env reader
├── lib/
│   ├── api-client.ts                   # the only Axios instance
│   ├── api-error.ts                    # ApiError and normalization
│   └── react-query.ts                  # client defaults and shared config types
├── mocks/                              # MSW worker/server and handlers
└── features/
    └── instructions/
        ├── api/
        │   ├── instruction-keys.ts
        │   ├── get-instructions.ts
        │   ├── set-instruction-active.ts
        │   └── archive-instruction.ts
        └── model/
            └── instruction.ts          # Zod schemas and inferred types
```

Shared transport, environment, error, and Query configuration belong in shared
layers. Endpoint knowledge stays in its owning feature. One operation lives in
one API module; do not add feature barrel exports.

Authentication is the documented cross-cutting exception: its session schemas
and request declarations live under `src/lib/auth` because user state and
session recovery serve every feature. The module still uses the single shared
client, runtime schemas, Query ownership, and shared-layer dependency direction.
See [authentication.md](authentication.md).

## Request declaration anatomy

Every query declaration **MUST** contain:

1. Zod input and response schemas, or direct imports of domain schemas.
2. Types inferred from those schemas.
3. Input normalization before both key creation and request execution.
4. A fetcher that calls `apiClient` and supplies the response schema.
5. A stable query-key factory and `queryOptions` declaration.
6. A feature hook that accepts only the supported Query configuration.
7. Focused tests for transport details, validation, keys, and cache behavior.

Every mutation declaration **MUST** contain the same schema/fetcher/hook pieces
and explicitly state how the mutation synchronizes affected caches. Cache
synchronization may be optimistic update plus rollback, invalidation, a direct
cache write, or a justified combination; leaving it implicit is not allowed.

## Runtime schemas and types

All boundary inputs, successful responses, and error payloads **MUST** be parsed
with Zod. TypeScript types **MUST** be inferred from the schemas rather than
duplicated as handwritten interfaces. Validation happens before a request is
sent and immediately after a response is received.

The target Instruction model is equivalent to:

```ts
import { z } from 'zod'

export const instructionSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  description: z.string(),
  url: z.string().url(),
  active: z.boolean(),
  archived: z.boolean(),
})

export const instructionPageSchema = z.object({
  items: z.array(instructionSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  first: z.number().int().nonnegative(),
  last: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
})

export type Instruction = z.infer<typeof instructionSchema>
export type InstructionPage = z.infer<typeof instructionPageSchema>
```

## Instructions mock contract

MSW is the authoritative development and test backend. Its Instructions
contract is:

- `GET /instructions?term&page&pageSize` returns `InstructionPage` directly.
  There is no `data` or `meta` envelope.
- `PATCH /instructions/:id` with `{ active: boolean }` returns `Instruction`.
- `PATCH /instructions/:id` with `{ archived: true }` returns `Instruction`.
- Errors use `{ message: string, code?: string }`.

`term`, `page`, and `pageSize` are validated and normalized. Unknown records
produce a validated 404 error payload. Mock state resets on browser reload and
after every test; persistence is out of scope.

## Query keys

Keys **MUST** be created by a feature-local factory. List keys include every
normalized value that can change the response. Code must not spell equivalent
ad hoc arrays elsewhere.

```ts
export type NormalizedInstructionQuery = {
  term: string
  page: number
  pageSize: number
}

export const instructionKeys = {
  all: ['instructions'] as const,
  lists: () => [...instructionKeys.all, 'list'] as const,
  list: (input: NormalizedInstructionQuery) =>
    [...instructionKeys.lists(), input] as const,
}
```

## Query and mutation examples

The implemented Instructions operations are the reference examples:
`src/features/instructions/api/get-instructions.ts` forwards the Query abort
signal to Axios, normalizes request input before key creation, and declares
status-qualified request-contract metadata. `set-instruction-active.ts`
performs optimistic updates with rollback and final invalidation;
`archive-instruction.ts` invalidates after success. Both mutation hooks isolate
follow-up refresh/callback failures so a confirmed write remains successful.
Read the [error-handling standard](error-handling.md) for feedback, reporting,
cancellation, and recovery ownership. New operations should begin with the
generator and resolve its domain-specific TODOs.

## Shared errors

The shared layer **MUST** expose one `ApiError` abstraction with exactly these
kinds:

- `network`: Axios could not receive an HTTP response.
- `http`: the server returned a non-success status; parse the optional
  `{ message: string, code?: string }` payload before using it.
- `validation`: request, success response, environment, or error payload failed
  its Zod contract.
- `unknown`: no safer classification applies.

`ApiError` retains diagnostic context, including backend messages, privately.
Its message or code MUST NOT be displayed directly. Feature-owned safe copy and
application effects follow the [error-handling standard](error-handling.md).
The shared client must not depend on notifications, routing, translations, or
feature UI.

## Public environment

`src/config/env.ts` is the only module that reads `import.meta.env`. Its public
`env` object exposes `API_URL`, `ENABLE_API_MOCKING`, and `IS_DEVELOPMENT`.
`VITE_API_URL` defaults to `/api`. `VITE_ENABLE_API_MOCKING` accepts only
`true` or `false`; when omitted, mocking defaults to enabled in development.
Production forces the public flag to `false`, even if it is explicitly supplied
as `true`. `.env.example` contains the non-secret local defaults.

## Testing policy

Each request declaration **MUST** have colocated focused tests that cover:

- HTTP method, path, normalized query parameters, and request body.
- Valid response parsing and invalid response rejection.
- Query-key identity and normalized-input equivalence.
- Mutation cache behavior, including optimistic success and rollback where
  applicable.
- Invalidation of every affected key.
- Network, HTTP, validation, and unknown error normalization at the shared
  layer.

Hook and UI tests use an isolated Query client from the shared render wrapper.
They use MSW overrides at the HTTP boundary and **MUST NOT** spy on fetchers.
The MSW test server fails on unhandled requests and resets handlers and data
after every test.

Tests that need deterministic failures use `instructionsNetworkFailure` or
`instructionsHttpError` from `src/mocks/failure-overrides.ts` with
`server.use(...)`. These overrides stay at the HTTP boundary and must not be
implemented in production request declarations or UI code.

## Mocking policy

MSW is **REQUIRED** for development and tests until a real backend contract is
available. The browser worker starts only in development and only when
`env.ENABLE_API_MOCKING` is true. Production must never start MSW. Tests start a
Node MSW server globally, reject unhandled requests, and reset all state after
each test.

The production build enforces that boundary: it fails if an emitted chunk
contains a module from `src/mocks` or `msw`, and it removes the development-only
worker that Vite copies from `public/`. Keep the Vite-defined
`__APP_DEVELOPMENT__` guard at the dynamic-import site so Rollup can eliminate
the mock graph without adding environment reads outside `src/config/env.ts`.

Unit tests may mock a pure, non-HTTP collaborator when useful. They **SHOULD**
exercise API declarations through MSW so validation, serialization, error
normalization, and cache behavior are verified together.

## Generator policy

Use the deterministic, non-interactive command below for each new API
operation:

```bash
bun run generate:api --feature <feature> --kind <query|mutation> --name <kebab-name> --resource <resource>
```

All four value options are required exactly once. `feature`, `name`, and
`resource` use lowercase kebab-case: they start with a lowercase letter and may
contain lowercase letters or digits, with single hyphens between segments. The
feature must already exist under `src/features`; the generator never creates a
feature. Unknown options, positional arguments, duplicate options, path
separators, traversal values, and any existing target file are rejected with a
non-zero exit code.

For example:

```bash
bun run generate:api --feature instructions --kind query --name get-instruction-history --resource instruction-history
bun run generate:api --feature instructions --kind mutation --name restore-instruction --resource instructions
```

Each successful invocation creates exactly these files and no barrel export:

```text
src/features/<feature>/api/<name>.ts
src/features/<feature>/api/<name>.test.tsx
```

Query output contains strict request/response schemas with inferred types,
request-validation context, normalized keys, a shared-client fetcher that
forwards the Query abort signal, `queryOptions`, and a hook whose shared
`QueryConfig` cannot replace the canonical key or fetcher. It includes
status-qualified request-contract metadata and a placeholder-data decision.
Mutation output contains strict schemas, request-validation context, a
shared-client fetcher, and a hook with conservative invalidation. Follow-up
refresh and consumer callback failures are reported separately from a
confirmed write. Both kinds require domain-specific ownership and test choices
before use; the scaffolds do not select UI copy or automatic retries.

Any domain-specific decision the generator cannot make is marked
`API_GENERATOR_TODO`. This includes concrete schema fields, the final method and
endpoint, serialization, precise cache effects or rollback, pagination
semantics, request origin, status-qualified backend codes, feedback ownership,
safe failures, cancellation, and MSW assertions. Generated work is incomplete
and **MUST NOT be committed while any `API_GENERATOR_TODO` sentinel remains**. Replace every
sentinel with the domain decision, implement the colocated MSW tests, and run
`bun run verify`. `bun run check:api` blocks unresolved sentinels in operation
and test files.

Append `--dry-run` to validate the invocation and inspect deterministic target
paths and fully formatted output without creating the `api` directory or any
file:

```bash
bun run generate:api --feature instructions --kind query --name get-instruction-history --resource instruction-history --dry-run
```

Generation formats both outputs with the repository Prettier configuration and
publishes them as a pair. It never overwrites existing work and rolls back its
own output if both files cannot be published. The generator implementation is
under `tools/generators/api`; its parsing, planning, rendering, and writing
functions are importable for focused tests, while `cli.ts` only handles process
input, output, and exit status.

Using the generator is **REQUIRED** for a new operation unless the
generator cannot represent it. In that case, follow the same file anatomy
manually and record why generation was skipped. Editing generated scaffolds to
complete schemas, paths, cache rules, and tests is always required.

## Required choices and optional choices

Required repository choices are Axios, Zod, TanStack Query, one shared client,
one file per operation, runtime validation, feature key factories, explicit
mutation cache behavior, MSW at the HTTP boundary, and hooks/types as the only
UI-facing API surface.

Optional implementation choices include exact filenames within the documented
folders, whether read-only key helpers have their own module, consumer callback
support in hook configuration, and direct cache writes in addition to required
invalidation. Optional choices must preserve the boundaries and public
contracts above.

## Eight-stage migration sequence

The approved program is sequential:

1. **Codify the API standard** — add this guide and agent rules.
2. **Build shared API and Query infrastructure** — environment, Axios/Zod
   client, `ApiError`, Query defaults/provider, and test wrapper.
3. **Add the MSW development and test API** — implement and test the documented
   Instructions HTTP contract.
4. **Implement Instructions request declarations and hooks** — schemas,
   fetchers, keys, query options, hooks, and cache behavior; UI remains legacy.
5. **Migrate the UI fully to feature APIs** — move all Instructions server state
   to Query hooks and keep deterministic data exclusively at the MSW boundary.
6. **Add the deterministic API generator** — completed; query/mutation scaffolds,
   validation, collision refusal, dry run, and tests.
7. **Enforce the architecture in lint, checks, and CI** — block direct transport,
   environment, fetcher, provider, and unfinished-generator violations.
8. **Final documentation, audit, and release readiness** — completed; public
   docs match the implementation and production-safe mocking is verified.

`bun run check:api` uses the TypeScript parser to verify operation schemas,
fetchers, matching query/mutation hooks, shared-client use, explicit response
schemas, absence of notification imports in API modules, UI-facing hook/type
imports, generator sentinels in source and tests, and Query provider
installation. ESLint separately blocks Axios outside the shared client, direct
`fetch`, UI imports of `apiClient`, and direct environment reads outside
`src/config/env.ts`. Both layers run in the local verification gate, lefthook,
and CI.

Deterministic development and test records belong to MSW under `src/mocks`;
production feature code contains no in-process data repository.
