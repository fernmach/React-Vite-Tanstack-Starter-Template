# TODO

## Authentication and authorization program

- [x] Reconcile the product policy and document the cookie-JWT, CSRF, role, permission, and backend security contracts (Task 1).
- [x] Add validated auth schemas and operations plus deterministic anonymous, editor, admin, expiry, refresh, logout, and CSRF MSW behavior (Task 2).
- [x] Implement the project-owned Query-backed AuthProvider and shared test render support (Task 3).
- [x] Connect single-flight 401 recovery and protected-cache hygiene without mutation replay (Task 4).
- [x] Add login, logout, safe redirect, shell, and route-guard integration (Task 5).
- [x] Enforce instruction permissions in the UI and MSW instruction endpoints (Task 6).
- [x] Complete cross-feature security hardening and backend-readiness verification (Task 7).

## Error handling implementation — baseline complete

- [x] Separate transport normalization from successful-response validation, carry validation phase and occurrence identity, and forward Instructions query cancellation.
- [x] Compose Sonner-backed accessible notifications and application authentication-required effects with episode reset.
- [x] Add sanitized vendor-neutral reporting, cache execution ownership, and reporter-failure isolation.
- [x] Prove application, route, section, and startup containment with explicit recovery.
- [x] Complete Instructions local mutation feedback, safe code mapping, placeholder isolation, and background query recovery (Task 5).
- [x] Reconcile and enforce the error-handling contract in `AGENTS.md`, the generator, and `check:api` (Task 6).

## Final hardening — complete

- [x] Complete the final release audit and exclude externally generated `docs/frontend/**` artifacts from repository-owned Prettier checks without rewriting them.
- [x] Remove development-only MSW modules and the public worker from production output, with a build-time module-graph assertion.
- [x] Verify development interception in a standard browser: `/instrucoes` renders all 48 MSW-backed records without contract-error UI or browser errors.

## API layer program — complete

- [x] Adopt and document the Bulletproof API-layer architecture.
- [x] Add the validated shared client, errors, Query provider, and test helpers.
- [x] Add MSW development/test contracts with isolated Instructions state.
- [x] Add validated Instructions operations, Query hooks, and explicit mutation cache behavior.
- [x] Move the Instructions UI completely onto the feature API hooks.
- [x] Add the deterministic API generator and its dry-run/collision safeguards.
- [x] Enforce API boundaries in ESLint, `check:api`, lefthook, and CI.
- [x] Reconcile public docs and verify production-safe release readiness.

## Done

- [x] Adopt feature-oriented source organization with enforced ESLint boundaries
- [x] Migrate UI primitives from Radix to **Base UI** (`@base-ui/react`)
  - [x] Rewrite `button.tsx` using `useRender` (`render` prop replaces `asChild`)
  - [x] Remove `@radix-ui/react-slot` and unused `@radix-ui/react-select`
  - [x] Add Vitest + Testing Library setup and `button.test.tsx`
  - [x] Update README, design-system docs, and add component instructions
- [x] Add baseline shadcn components: `card` and `input` (with tests)
- [x] Reconcile README — removed the "React Router DOM" mention (not a dependency; routing is TanStack Router)
- [x] Add CI workflow (`.github/workflows/ci.yml`) running `lint`, `test`, and `build`
- [x] AI-agent-ready upgrade ([spec](docs/superpowers/specs/2026-06-26-ai-agent-ready-starter-design.md))
  - [x] Add `AGENTS.md` (canonical) + reduce `CLAUDE.md` to a pointer
  - [x] Add `llms.txt`, `.cursor/rules/project.mdc`, and `.mcp.json` (Playwright)
  - [x] Add Prettier (+ Tailwind class sorting) and `eslint-config-prettier`
  - [x] Add `typecheck`, `format`, `check`, and `verify` scripts
  - [x] Add lefthook + lint-staged pre-commit hook
  - [x] Extend CI with `typecheck` + `format:check`; add `.github/dependabot.yml`

- [x] Major dependency upgrades (vite 6→8, eslint 9→10, TS 5.8→6, lucide 0→1) — `bun audit` now clean
  - [x] Drop deprecated `baseUrl` from tsconfigs (TS 6)
  - [x] Add `overrides.vite` to dedupe vite (vitest/@tailwindcss/vite pulled vite 6)
  - [x] Replace removed `Github` lucide icon with `Rocket`

- [x] Clear the Dependabot backlog (PRs #3, #12, #13, #14, #17, #18)
  - [x] Bump `jsdom` 29→30 and `@testing-library/jest-dom` 6→7 (with `bun.lock`)
  - [x] Bump `actions/checkout` v4→v7 (v4 targets deprecated Node 20)
  - [x] Switch Dependabot to the `bun` ecosystem so future PRs update `bun.lock`
  - [x] Hold back TS 7 — `typescript-eslint` still pins `typescript <6.1.0`

## Backlog

- [ ] Remediate the 15 advisories reported by `bun audit` on 2026-10-01 (10 high,
      5 moderate across Vitest, Browserslist/build tooling, brace-expansion,
      nanoid, and PostCSS paths), then rerun the full release gate.

- [ ] Add further shadcn/Base UI components on demand (`bunx shadcn@latest add <name> --base base`)
- [ ] Adopt TypeScript 7 once `typescript-eslint` supports it (drop the
      `typescript` major-version ignore in `.github/dependabot.yml`)
- [ ] AI-app on-ramp: streaming Claude example, typed env validation, server function for key safety
