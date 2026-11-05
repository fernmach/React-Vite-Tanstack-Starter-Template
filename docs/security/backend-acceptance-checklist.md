# Backend security acceptance checklist

This checklist separates guarantees demonstrated by this frontend repository
from controls that only a production backend and a deployed browser environment
can prove. MSW is deterministic contract test infrastructure; it is not evidence
that a browser accepted, scoped, protected, rotated, or deleted a real cookie.

## Evidence proven by frontend tests and builds

- [x] Session, login, refresh, logout, role, permission, and CSRF response shapes
      are runtime-validated before entering the canonical TanStack Query cache.
- [x] Browser code neither reads nor decodes access/refresh JWTs; auth source has
      no localStorage, sessionStorage, IndexedDB, or cookie access.
- [x] Passwords and CSRF values are absent from tested URLs, browser storage,
      visible auth feedback, notifications, console output, and sanitized error
      reports.
- [x] Concurrent 401s share one refresh; success adopts the authoritative session
      and permission set, while revoked refresh signs out once.
- [x] Public instruction cache survives recovery, failed refresh, and logout;
      protected cache is removed on sign-out.
- [x] A 403 never initiates refresh, and a failed mutation is never replayed.
- [x] Auth failures use controlled application copy rather than backend messages.
- [x] Production source has no untrusted HTML rendering sink.
- [x] The production module graph and emitted artifacts exclude MSW browser code,
      the public worker, deterministic accounts/passwords/CSRF prefixes, and
      TanStack query/router development tools.

These checks prove frontend behavior for the tested flows. They do not turn UI
permission checks into authorization and do not prove any backend or browser
cookie property.

## Required backend controls

### Transport, cookies, and browser boundary

- [ ] Serve authentication endpoints and the application only over HTTPS/TLS.
- [ ] Set access and refresh cookies as `Secure`, `HttpOnly`, host-only cookies
      (no `Domain` attribute), with the narrowest practical `Path` and bounded
      expiry.
- [ ] Set an explicit `SameSite=Lax` or stricter policy; document any exception.
- [ ] Allow only exact trusted CORS origins, send credentials only where needed,
      reject wildcard credentialed CORS, and vary responses correctly by origin.
- [ ] Verify deployed cookie creation, inclusion, rotation, expiry, scoping, CORS,
      preflight, and cross-site behavior in real browsers.

### Token and session lifecycle

- [ ] Verify JWT issuer, audience, approved signature algorithm, signature,
      expiry, not-before where used, and a small documented clock-skew allowance.
- [ ] Keep access tokens short-lived.
- [ ] Rotate refresh tokens after every use, detect reuse, and revoke the entire
      replay family when reuse is detected.
- [ ] Revoke the server-side session and expire both cookies on logout.
- [ ] Verify and rotate the CSRF token server-side for every state-changing auth
      flow; validate `Origin`/`Sec-Fetch-Site` where appropriate. SameSite is only
      defense in depth.

### Authorization and account protection

- [ ] Enforce permissions server-side on every mutation, independent of hidden
      controls, route guards, roles, or permissions supplied by the browser.
- [ ] Rate-limit authentication and recovery endpoints and add credential-
      stuffing defenses with privacy-preserving monitoring and escalation.
- [ ] Hash passwords with a current memory-hard password hash and calibrated work
      factor; never log passwords or reversible equivalents.
- [ ] Make password reset tokens single-use, short-lived, securely random, stored
      safely, and invalidated after use; avoid account enumeration and invalidate
      affected sessions after a successful reset.
- [ ] Preserve an MFA-ready session/authentication model for later policy needs;
      MFA enrollment, challenge, and recovery UI are intentionally out of scope.
- [ ] Return generic authentication errors that do not reveal whether an account
      exists, is locked, or uses a particular factor.

### Platform defenses and operations

- [ ] Deploy a restrictive CSP and HSTS, and prevent clickjacking with CSP
      `frame-ancestors` (plus `X-Frame-Options` where legacy coverage is needed).
- [ ] Produce tamper-resistant authentication, authorization, refresh-reuse, and
      administrative audit events without cookies, tokens, passwords, CSRF
      values, request bodies, or unnecessary personal data.
- [ ] Maintain dependency inventory, automated advisory monitoring, timely patch
      SLAs, lockfile review, and reproducible build/release evidence.
- [ ] Exercise login, refresh, logout, permission changes, revocation, CSRF, CORS,
      cookie flags, and failure paths against the deployed backend in real browsers.

## Release evidence (2026-10-01)

- Focused Task 7 suite: `13` tests passed across the cross-feature security
  matrix, source regression checks, provider/devtool behavior, and
  artifact-inspector fixtures after fixes.
- `bun audit` with Bun `1.4.2` reported **15 vulnerabilities: 10 high and 5
  moderate**: `@vitest/mocker@4.1.9` and `vitest@4.1.9` each reported
  GHSA-82fw-gwwq-j7x9; `baseline-browser-mapping@2.10.40` reported
  GHSA-w5vr-8v7q-w6rv; `brace-expansion@5.0.6` reported
  GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895, GHSA-3jxr-9vmj-r5cp,
  GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, and GHSA-q2hr-2g5m-vwhr;
  `browserslist@4.28.4` reported GHSA-c83g-rgw3-j3cx and
  GHSA-73wf-gq98-2v4g; `nanoid@3.3.15` reported GHSA-28wg-ghj8-5hjv and
  GHSA-2v37-7h3g-55p8; and `postcss@8.5.15` reported
  GHSA-fxqj-rqcc-2cmp and GHSA-r28c-9q8g-f849. These development/build-path
  advisories are not hidden or waived; remediation remains tracked in `TODO.md`.
- `bun run verify` passed: lint, TypeScript, Prettier, API architecture, all
  `40` test files / `244` tests, and the production build passed. Vite transformed
  `399` modules, and the emitted-artifact security check passed.

## Remaining limitations

The frontend follows the original Bulletproof React intent: keep secrets out of
browser-controlled storage, validate server data, centralize auth state, treat
client authorization as presentation only, and exclude development facilities
from production. The browser still executes user-controlled code and cannot
protect secrets delivered to JavaScript. A future backend remains responsible
for cookies, token validity, session and permission authority, CSRF enforcement,
account defenses, response headers, and audit operations. Registration, reset,
MFA UI, account/role administration, and instruction create/edit pages remain
deliberately unimplemented.
