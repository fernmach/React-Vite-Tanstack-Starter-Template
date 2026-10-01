# Authentication and Authorization

This is the canonical frontend authentication contract for task-desk. It
applies the security principles from the
[Bulletproof React security guide](https://github.com/alan2207/bulletproof-react/blob/master/docs/security.md)
without replacing this repository's Axios, Zod, TanStack Query, and error
boundaries.

## Current boundary

The typed schemas, request declarations, deterministic MSW service,
project-owned `AuthProvider`, and application-owned 401 recovery are
implemented. The login interface, route integration, and instruction
permission enforcement are later tasks.

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

Before replacing MSW, verify TLS and HSTS; host-only `Secure`, `HttpOnly`,
explicitly `SameSite` cookies; JWT issuer, audience, signature, expiry, and
algorithm checks; refresh reuse detection and revocation; CSRF and `Origin`
validation; exact credentialed CORS origins; permission enforcement; login
throttling; secure password hashing; safe audit records; CSP; clickjacking
protection; and a restrictive referrer policy.
