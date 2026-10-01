# Authentication and Authorization

This is the canonical frontend authentication contract for task-desk. It
applies the security principles from the
[Bulletproof React security guide](https://github.com/alan2207/bulletproof-react/blob/master/docs/security.md)
without replacing this repository's Axios, Zod, TanStack Query, and error
boundaries.

## Current boundary

The typed schemas, request declarations, deterministic MSW service,
project-owned `AuthProvider`, application-owned 401 recovery, login route,
application-shell session controls, reusable route guards, and instruction
permission enforcement are implemented.

Authentication is a cross-cutting shared responsibility under `src/lib/auth`.
It may import domain-neutral shared modules but must not import features, app
composition, or routes. The backend is always the authoritative security
boundary; browser-side authorization only improves the user experience.

`AuthProvider` is composed inside the global `QueryClientProvider` and uses
`['auth', 'session']` as the sole user and CSRF state. Its public states remain
distinct: initial loading, anonymous, authenticated, explicit retry/recovery,
and startup error. Successful login replaces the session only after response
validation. Logout always clears the local user and queries marked
`meta.requiresAuth`, including when its transport request fails; public cached
data is preserved. The application recovery effect retains the authenticated
user while refresh is in flight, so the provider exposes `recovering` without a
destructive UI transition.

## Login, logout, and routing

`/login` is a thin TanStack Router route that delegates its accessible,
controlled email/password form to `src/features/auth`. The form uses Zod at the
UI boundary, browser-standard labels and autocomplete values, native keyboard
submission, disabled progress states, and live status/error announcements.
Invalid credentials and transport failures map to application-owned Portuguese
copy; raw backend messages are never rendered.

Successful login updates `['auth', 'session']` before navigation. A requested
destination is retained only when it is a same-origin root-relative path.
Absolute and protocol-relative URLs, backslashes, control characters,
malformed encodings, encoded redirect forms, and `/login` self-loops are
discarded. Safe query strings and fragments are preserved. `/instrucoes` is the
default destination, and authenticated visitors to `/login` are redirected
there or to the same validated destination.

The application shell renders `Entrar` for anonymous sessions, a non-interactive
live status during loading or recovery, and the schema-validated user name plus
`Sair` for authenticated sessions. Logout delegates to `AuthProvider`; local
user and protected-query cleanup therefore completes even when the server call
fails, after which the shell announces safe failure copy.

`requireAuthentication` and `requirePermission` in
`src/lib/auth/route-guards.ts` are generic TanStack Router `beforeLoad` helpers.
They read the same Query client supplied to `AuthProvider`, preserve only a
validated login destination for anonymous users, and redirect authenticated
users without a required permission to the public default. These guards are UX
controls only; the backend remains authoritative. Router devtools are lazy and
development-only so their module is absent from production output.

## Session ownership

The future backend owns short-lived access JWTs and rotating refresh JWTs in
host-only `Secure`, `HttpOnly` cookies over HTTPS. Frontend code never reads,
decodes, persists, or derives permissions from either token. The backend must
use an explicit `SameSite=Lax` or stricter policy, exact credentialed CORS
origins, refresh rotation and reuse detection, session revocation, bounded
expiry, and server-side authorization for every protected operation.

MSW models the resulting session state in memory. It does not prove browser
enforcement of cookie attributes; that requires the real backend and browser
integration tests.

## Roles and permissions

Anonymous users may view and search instructions. Editors receive
`instructions:create`, `instructions:update`, and
`instructions:set-active`. Administrators receive all editor permissions plus
`instructions:archive`. Session responses supply both roles and permissions,
and the client treats that validated response as authoritative.

| Instruction capability                             | Anonymous       | Editor | Administrator |
| -------------------------------------------------- | --------------- | ------ | ------------- |
| List, search, paginate, and follow read-only links | Yes             | Yes    | Yes           |
| Create                                             | No              | Yes    | Yes           |
| Edit                                               | No              | Yes    | Yes           |
| Change active state                                | Read-only state | Yes    | Yes           |
| Archive                                            | No              | No     | Yes           |

Instruction UI components derive affordances exclusively from
`AuthProvider.can(permission)`. They omit unavailable create, edit, toggle, and
archive controls rather than rendering misleading disabled actions. Active
state remains visible as semantic read-only text when the toggle is not
available. These checks are a usability layer, not a security boundary.

The MSW instruction handlers independently enforce the same permission matrix
for `POST /instructions` and each supported `PATCH /instructions/:id` shape.
They return a structured `401 AUTHENTICATION_REQUIRED` response when no valid
session exists and `403 FORBIDDEN` when an authenticated principal lacks the
operation's permission. A 403 receives distinct safe local feedback and never
starts authentication recovery. A 401 may start the ordinary single-flight
recovery episode, but the failed mutation is never replayed.

## HTTP contract

- `GET /auth/session` returns
  `200 { user: AuthUser | null, csrfToken: string }`. Anonymous startup is not a 401.
- `POST /auth/login` accepts `{ email, password }`, requires
  `X-CSRF-Token`, and returns the authenticated session. Invalid credentials
  return `401 INVALID_CREDENTIALS` without starting refresh recovery.
- `POST /auth/refresh` requires `X-CSRF-Token`, rotates the JWT cookies and
  CSRF token, and returns the authenticated session. An invalid refresh session
  returns `401 SESSION_EXPIRED`.
- `POST /auth/logout` requires `X-CSRF-Token`, revokes the refresh session,
  expires both cookies, and returns `200 { success: true }`.
- Instruction mutation authorization maps create to `instructions:create`,
  general updates to `instructions:update`, active-state changes to
  `instructions:set-active`, and archive to `instructions:archive`.

The CSRF token stays in memory, is sent only in the `X-CSRF-Token` header on
state-changing authentication requests, and rotates after login and refresh.
It must never enter browser storage, URLs, or diagnostics. The backend must bind
and verify it; `SameSite` remains defense in depth rather than a replacement.

## Failure and recovery policy

Authentication operations that intentionally handle a 401 mark the request as
`authenticationFailure: 'ignore'`, preventing invalid login or rejected refresh
from recursively publishing the shared authentication-required event. Other
401 responses retain the existing application event contract.

The single application-owned recovery effect subscribes to the shared event
channel and coalesces each active 401 episode into one refresh promise. It calls
`POST /auth/refresh` with the current in-memory CSRF token. A successful,
validated response replaces the canonical session and rotated CSRF token,
resets the episode, and refetches only active queries marked
`meta.requiresAuth`. Public instruction reads are explicitly marked public and
are neither invalidated nor recovery-refetched. Mutations are never replayed
automatically.

A failed refresh replaces the canonical session with anonymous state, cancels
and removes protected queries, preserves public query data, resets the episode,
and shows one application-owned `Sessão expirada` notification containing only
safe static copy. Login and refresh requests use
`authenticationFailure: 'ignore'`, so their 401 responses cannot recurse. A
403 means insufficient permission and never starts refresh. Resetting the
single-flight state after either outcome allows a later independent 401 episode
to recover normally.

## Backend acceptance checklist

The release-ready checklist is maintained in
[`docs/security/backend-acceptance-checklist.md`](../security/backend-acceptance-checklist.md).
It labels frontend/build evidence separately from backend and deployed-browser
obligations, including cookie flags, TLS/CORS, JWT verification, refresh reuse
detection, CSRF rotation, mutation authorization, account defenses, security
headers, secret-free auditing, dependency management, and real-browser proof.
