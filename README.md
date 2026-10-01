<div align="center">

# React · Vite · TanStack Starter

A modern, type-safe React starter template — **Vite**, **TanStack Router & Query**, **TailwindCSS v4**, and **shadcn/ui** on **Base UI** primitives.

[![CI](https://github.com/whereissam/React-Vite-Tanstack-Starter-Template/actions/workflows/ci.yml/badge.svg)](https://github.com/whereissam/React-Vite-Tanstack-Starter-Template/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)

</div>

---

## Features

- **Vite 8** — lightning-fast dev server and build
- **React 19** — the latest React with modern features
- **TypeScript** — strict, end-to-end type safety
- **TailwindCSS v4** — utility-first styling via the new Vite plugin
- **shadcn/ui** — beautiful, accessible components on **Base UI** primitives
- **TanStack Router** — type-safe, file-based routing
- **TanStack Query** — data fetching, caching, and server state
- **Vitest** — unit testing with Testing Library
- **ESLint + Prettier** — linting and formatting (Tailwind class sorting) out of the box
- **AI-agent ready** — `AGENTS.md`, `llms.txt`, and `.mcp.json` so AI tools work productively in this repo
- **Pre-commit hooks** — lefthook + lint-staged auto-fix staged files
- **CI + Dependabot** — GitHub Actions (lint, typecheck, format, test, build) and weekly dependency updates

## Quick Start

> Click **["Use this template"](https://github.com/whereissam/React-Vite-Tanstack-Starter-Template/generate)** on GitHub to start a new repo from this starter.

```bash
# 1. Clone (or use the template button above)
git clone https://github.com/whereissam/React-Vite-Tanstack-Starter-Template.git
cd React-Vite-Tanstack-Starter-Template

# 2. Install dependencies
bun install

# 3. Create a local environment file and review its values
cp .env.example .env.local

# 4. Start the dev server
bun run dev
```

Then open **[http://localhost:5173](http://localhost:5173)**.

> **Prerequisites:** [Bun](https://bun.sh) 1.0+ (Node.js 20.19+ / 22.12+ also works for the toolchain).

## Scripts

| Command                | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `bun run dev`          | Start the development server                        |
| `bun run build`        | Type-check and build for production                 |
| `bun run preview`      | Preview the production build                        |
| `bun run lint`         | Run ESLint                                          |
| `bun run typecheck`    | Type-check only (`tsc --noEmit`)                    |
| `bun run format`       | Format all files with Prettier                      |
| `bun run format:check` | Check formatting without writing                    |
| `bun run generate:api` | Scaffold one feature-owned query or mutation        |
| `bun run check:api`    | Validate API operation and consumer architecture    |
| `bun run check`        | Lint + typecheck + format + API architecture        |
| `bun run verify`       | Full gate: check + test + build (run before "done") |
| `bun run test`         | Run the test suite once                             |
| `bun run test:watch`   | Run tests in watch mode                             |

## Components

### Authentication contract

Task-desk defines a project-owned cookie authentication boundary without an
external auth client library. The implemented baseline includes a global
TanStack Query-backed `AuthProvider`, validated session, login, refresh, and
logout operations, and an MSW service for anonymous, editor, and administrator
sessions. The provider owns the in-memory user and CSRF session cache, exposes
generic role and permission checks, and removes protected query data on logout.
The application coalesces concurrent 401s into one refresh, retains the current
user while recovering, selectively refetches active protected queries after
success, and signs out locally without erasing public cache data after failure.
A future backend owns access and rotating refresh JWTs in secure HttpOnly
cookies; browser code receives only the validated user and an in-memory CSRF
token.

The `/login` route now provides a controlled, validated email/password form,
safe same-origin redirect restoration, and generic authentication and
permission guards for future protected routes. The application shell reflects
loading, recovery, anonymous, and authenticated states, and logout always
clears local private state even if the transport request fails. Router devtools
are loaded only in development.

Instruction reads remain public. The instruction UI uses the provider's
permission checks to show create, edit, and active-state controls to editors,
add archive controls for administrators, and render active state as read-only
text for anonymous visitors. The MSW API boundary separately enforces the same
matrix and returns safe structured 401 or 403 failures; hiding a control is
never treated as authorization. Failed mutations are not replayed during 401
recovery, and 403 feedback remains distinct from session expiry. See the
[authentication architecture](docs/architecture/authentication.md) for the
contract and role matrix, and the
[backend security acceptance checklist](docs/security/backend-acceptance-checklist.md)
for an explicit split between frontend evidence and controls that require the
future backend or a deployed real-browser environment.

Task 7 adds a cross-feature release matrix for login, recovery, permission
changes, revoked refresh, logout, cache hygiene, forbidden access, and mutation
non-replay. Static regression tests block auth-sensitive browser persistence and
untrusted HTML sinks. Every production build also scans emitted artifacts and
fails if they contain the MSW worker/runtime, deterministic mock credentials or
CSRF prefixes, or TanStack development tools. `bun audit` remains a separate,
explicit release check because advisory data changes independently of source.

### Error containment and reporting

Application and route failures show safe fallbacks with explicit retry, reload,
and home navigation. `SectionErrorBoundary` from
`src/components/errors/error-boundary.tsx` can isolate an optional page section.
Startup failures, including invalid environment values and mock initialization,
show a minimal fallback before React mounts.

Install a vendor adapter with `errorReporting.configure({ reporter })` from
`src/lib/error-reporting.ts`. The adapter receives sanitized structured records,
never raw errors or request data. The default logs safe development diagnostics
and sends nothing externally in production. Query and mutation cache callbacks
report unexpected failures once per execution; retries remain disabled.
Instructions query failures show safe Portuguese copy with retry. A failed
background refresh keeps valid results visible, and write failures show local
feedback beside the active control or inside the archive dialog. See the
[error-handling architecture](docs/architecture/error-handling.md) for the
ownership and recovery details.

### UI primitives

This template ships with `button`, `card`, and `input` from **shadcn/ui**, built on **Base UI** primitives. Add more with the CLI — pass `--base base` so it installs the Base UI versions:

```bash
bunx shadcn@latest add dialog --base base
bunx shadcn@latest add dropdown-menu --base base
```

> **Migrating from Radix?** Base UI replaces the `asChild` prop with a `render` prop.
> To change a component's underlying element, pass an element to `render`:
>
> ```tsx
> // Radix:    <Button asChild><a href="/">Home</a></Button>
> // Base UI:  <Button render={<a href="/" />}>Home</Button>
> ```

## Project Structure

```
src/
├── app/
│   ├── layouts/          # Global application shell and navigation
│   └── provider.tsx      # Query client composition
├── components/
│   └── ui/              # Reusable, domain-neutral shadcn primitives
├── config/
│   └── env.ts           # Validated public environment boundary
├── features/
│   └── instructions/
│       ├── api/         # Schemas, requests, query keys, and hooks
│       ├── components/  # Feature UI with colocated tests
│       ├── model/       # Instruction domain types
│       └── pages/       # Instructions page composition
├── lib/
│   ├── api-client.ts    # Shared Axios transport and response validation
│   ├── api-error.ts     # Normalized API errors
│   └── react-query.ts   # Query client defaults and shared option types
├── mocks/               # MSW browser/Node entry points, handlers, and data
├── routes/              # Thin TanStack Router declarations
│   ├── __root.tsx       # Root layout route
│   ├── index.tsx        # Redirects / to /instrucoes
│   └── instrucoes.tsx   # Instructions route declaration
├── test/
│   └── setup.ts         # Shared Vitest + Testing Library setup
├── main.tsx             # App entry
└── index.css            # Tailwind + design tokens

tools/
├── check-api/            # TypeScript-aware API architecture enforcement
└── generators/api/       # Deterministic API operation generator
```

## Tech Stack

| Layer          | Tools                                                        |
| -------------- | ------------------------------------------------------------ |
| **Framework**  | React 19, TypeScript                                         |
| **Build**      | Vite 8                                                       |
| **Routing**    | TanStack Router (file-based)                                 |
| **Data**       | TanStack Query                                               |
| **Styling**    | TailwindCSS v4, `class-variance-authority`, `tailwind-merge` |
| **Components** | shadcn/ui on Base UI, Lucide icons                           |
| **Testing**    | Vitest, Testing Library                                      |
| **Quality**    | ESLint, Prettier, lefthook, GitHub Actions CI, Dependabot    |

## Routing

Routing is file-based via TanStack Router — add a file in `src/routes/` and the route tree is generated automatically:

| File                        | Route                            |
| --------------------------- | -------------------------------- |
| `src/routes/index.tsx`      | `/` → redirects to `/instrucoes` |
| `src/routes/instrucoes.tsx` | `/instrucoes`                    |

Feature code is organized by business capability. Route files contain only
router concerns and delegate rendering to feature pages. ESLint enforces the
dependency direction `shared → features → app/routes`.

## API and environment

The canonical rules are in [API Layer Architecture](./docs/architecture/api-layer.md),
which adopts the [Bulletproof React API Layer guide](https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md).
All HTTP calls go through `src/lib/api-client.ts`; feature operations own their
Zod schemas, request functions, query keys, hooks, and cache behavior.

Vite exposes only these validated public variables:

| Variable                  | Default          | Behavior                                                                                                 |
| ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`            | `/api`           | Base path or absolute URL used by the shared API client.                                                 |
| `VITE_ENABLE_API_MOCKING` | development only | Accepts only `true` or `false`. It can disable MSW locally, but cannot enable MSW in a production build. |

`.env.example` contains safe local defaults. Put machine-specific values in
`.env.local`; never place secrets in a `VITE_` variable because Vite embeds
those values in browser assets.

MSW is the development and test API. Development starts the browser worker only
when the build is in development mode and mocking is enabled. Tests start the
Node server from `src/test/setup.ts`, fail on unhandled requests, and reset
handlers and mock state after each test. Production never starts MSW, even if
`VITE_ENABLE_API_MOCKING=true` is supplied accidentally. The production build
also fails if an emitted chunk contains `src/mocks`, MSW, or TanStack
development-tool modules; removes the development worker copied from `public/`;
and runs `bun run check:production` against emitted filenames and contents.

Create an operation with all required options:

```bash
bun run generate:api --feature instructions --kind query --name get-instruction-history --resource instruction-history
bun run generate:api --feature instructions --kind mutation --name restore-instruction --resource instructions
```

Preview the exact formatted output without writing files by appending
`--dry-run`:

```bash
bun run generate:api --feature instructions --kind query --name get-instruction-history --resource instruction-history --dry-run
```

The feature must already exist. The generator refuses invalid names and
collisions. Generated scaffolds include query cancellation, validation context,
reporting metadata, and mutation follow-up isolation. They are intentionally
incomplete: resolve every `API_GENERATOR_TODO` in the operation and test,
choose one visible feedback owner and precise cache behavior, add MSW contract
coverage, then run `bun run verify`. `bun run check:api` blocks unresolved
sentinels, missing explicit response schemas, and notification imports in API
modules.

## Styling

TailwindCSS v4 is wired through the Vite plugin and a semantic design-token system (see [`docs/design-system.md`](./docs/design-system.md)). It supports:

- CSS-variable design tokens with light/dark mode
- Component variants with `class-variance-authority`
- Class merging with `tailwind-merge`

## Testing

Unit tests run on **Vitest** with **Testing Library** in a jsdom environment. Tests live next to the code they cover (e.g. `src/components/ui/button.test.tsx`):

```bash
bun run test         # run once
bun run test:watch   # watch mode
```

## AI-Agent Ready

This template is built to be productive with AI coding tools out of the box:

| File             | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `AGENTS.md`      | Canonical conventions read by Cursor, Copilot, Codex, and others  |
| `CLAUDE.md`      | Pointer to `AGENTS.md` for Claude Code                            |
| `llms.txt`       | Concise project map in the [llms.txt](https://llmstxt.org) format |
| `.cursor/rules/` | Cursor rule that defers to `AGENTS.md`                            |
| `.mcp.json`      | MCP servers (ships with Playwright for UI verification)           |

Guardrails keep AI-generated changes honest: ESLint + Prettier, a **lefthook**
pre-commit hook that auto-fixes staged files and validates API boundaries, a
`bun run verify` gate (lint + typecheck + format + API architecture + test +
build), and **Dependabot** for weekly dependency updates.

## License

Released under the **MIT License** — free to use for personal and commercial projects.
