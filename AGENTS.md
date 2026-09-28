# AGENTS.md — Project Conventions for AI Agents

This is the **canonical** instructions file for this repository. It is read by
AI coding tools that follow the [AGENTS.md](https://agents.md) standard
(Cursor, GitHub Copilot, Codex, and others). `CLAUDE.md` points here.

## Stack Overview

| Layer      | Tools                                                        |
| ---------- | ------------------------------------------------------------ |
| Framework  | React 19, TypeScript (strict)                                |
| Build      | Vite                                                         |
| Routing    | TanStack Router (file-based, codegen)                        |
| Data       | TanStack Query                                               |
| Styling    | TailwindCSS v4, `class-variance-authority`, `tailwind-merge` |
| Components | shadcn/ui on Base UI primitives, Lucide icons                |
| Testing    | Vitest + Testing Library (jsdom)                             |
| Quality    | ESLint, Prettier, lefthook pre-commit, GitHub Actions CI     |

## Key Commands

Always use **`bun`** (never npm/yarn) and **`bunx`** (never npx).

| Command                | What it does                                                              |
| ---------------------- | ------------------------------------------------------------------------- |
| `bun run dev`          | Start the dev server                                                      |
| `bun run build`        | Type-check and build for production                                       |
| `bun run lint`         | Run ESLint                                                                |
| `bun run typecheck`    | Type-check only (`tsc --noEmit`)                                          |
| `bun run format`       | Format all files with Prettier                                            |
| `bun run format:check` | Check formatting without writing                                          |
| `bun run test`         | Run the Vitest suite once                                                 |
| `bun run check`        | Lint + typecheck + format check                                           |
| `bun run verify`       | **Full gate: check + test + build. Run this before declaring work done.** |

## Project Structure

```
src/
├── app/                    # Application composition only
│   └── layouts/            # Global shells and navigation
├── components/
│   └── ui/                 # Reusable, domain-neutral shadcn primitives
├── features/
│   └── <feature>/
│       ├── api/            # Service boundaries and data access
│       ├── components/     # Feature-owned UI and colocated tests
│       ├── model/          # Domain types and pure domain logic
│       └── pages/          # Route-level feature composition
├── lib/                    # Domain-neutral shared utilities
├── routes/                 # Thin TanStack Router declarations
├── test/                   # Shared test setup, factories, mocks, helpers
├── main.tsx                # App entry
└── index.css               # Tailwind + design tokens
```

`src/routeTree.gen.ts` is **generated** — never edit it by hand.

Feature subdirectories are created only when they have a real responsibility.
Do not add empty folders merely to reproduce the example tree.

## Architecture and Dependency Rules

Dependencies flow in one direction: **shared → features → app/routes**.

- `src/components`, `src/lib`, and `src/test` are shared layers. They MUST NOT
  import from `features`, `app`, or `routes`.
- A feature MAY import shared UI and utilities, but MUST NOT import from `app`,
  `routes`, or another feature's internal files.
- `app` and `routes` MAY compose features and shared modules.
- Route modules MUST remain thin: declare routing concerns and delegate page
  rendering to `src/features/<feature>/pages`.
- Domain-specific code MUST stay inside its owning feature. Move code into a
  shared layer only after it is genuinely reused and domain-neutral.
- Import concrete modules directly. Do not create broad feature `index.ts`
  barrel exports.
- Imports that cross directories or layers MUST use the `@/` alias. Relative
  imports are reserved for nearby files within the same feature responsibility.
- Deterministic development data belongs under `src/mocks`; reserve `fixture`
  for test-only data.

ESLint enforces these boundaries with scoped `no-restricted-imports` rules.
Every feature directory MUST be registered in the `featureNames` list in
`eslint.config.js`; adding an unregistered feature is incomplete work.

## API Layer (Mandatory)

- Follow [`docs/architecture/api-layer.md`](docs/architecture/api-layer.md) for
  all API client, schema, request declaration, query-key, mutation-cache,
  mocking, testing, and generator decisions.
- Use the single shared API client and validate boundary data with runtime
  schemas. Keep each request declaration in its owning feature.
- Components, pages, routes, and app composition may consume API hooks and
  types only. They MUST NOT call Axios, `fetch`, `apiClient`, or endpoint
  fetchers.
- Every mutation MUST declare its cache update, rollback, or invalidation
  behavior explicitly.

## Tooling Rules

- ALWAYS use `bun` instead of `npm` or `yarn` for TypeScript/JavaScript.
- ALWAYS use `bunx` instead of `npx`.
- ALWAYS use `uv` for Python package management and virtual environments.
- For iOS, use `swift build` and `swift test`.

## File Conventions

- `AGENTS.md` and `CLAUDE.md` belong in the repo root, not in subdirectories.
- Tests live next to the source they cover as `*.test.ts` or `*.test.tsx`.
- `src/test` contains only shared setup, render helpers, factories, and mocks.
- New features include focused tests and must pass the architecture lint rules.

## New Feature Checklist

1. Create `src/features/<feature>` with only the responsibility folders needed.
2. Register `<feature>` in `featureNames` inside `eslint.config.js`.
3. Keep route declarations thin and place page composition under the feature.
4. Add colocated tests for the feature behavior.
5. Update README or public documentation when routes, setup, or APIs change.
6. Run `bun run verify` before declaring the feature complete.

## Post-Implementation Checklist (MANDATORY after every feature)

1. Run `bun run verify` and fix all failures.
2. Update `TODO.md` to mark completed items and add any new items discovered.
3. Update `README.md` if new features affect the public API or setup.
4. Provide a conventional commit message (`feat:`, `fix:`, `docs:`, etc.).
5. Never stage all files — only stage files related to the current task.

## Git Rules

- Only `git add` files that were modified in the current task.
- Never force push.
- Use separate commits for logically distinct changes when asked.

## MCP Servers

`.mcp.json` configures [Model Context Protocol](https://modelcontextprotocol.io)
servers for agents that support them (e.g. Claude Code). It ships with a
**Playwright** browser-automation server so agents can drive and verify the UI:

```jsonc
// runs on demand via bunx; no global install needed
"playwright": { "command": "bunx", "args": ["@playwright/mcp@latest"] }
```

`.mcp.json` must be strict JSON (no comments). To add a server, add another entry
under `mcpServers`. Tool-specific support varies; the file is additive and safe to
ignore for tools that don't read it.
