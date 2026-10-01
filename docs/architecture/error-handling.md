# Error handling architecture

This is the canonical implemented error-handling standard for the standalone
template. Read it with the [API-layer standard](api-layer.md) and `AGENTS.md`.
The baseline uses the current transport, Query caches, application effects,
Instructions UI, and boundaries. Host session recovery and external telemetry
are optional integrations.

## Scope and requirement levels

This contract covers the shared Axios/Zod client, feature request declarations,
TanStack Query operations, and application/render failures. **MUST** and
**MUST NOT** state requirements. **SHOULD**
is the default unless review records a reason to differ. **MAY** and
**OPTIONAL** identify enhancements beyond the required baseline.

The baseline works without a live backend. Typed authentication operations and
the deterministic MSW service follow
[the authentication contract](authentication.md), while the AuthProvider,
login route, and token-refresh orchestration remain later tasks. No external
error-reporting vendor is required.

## Implemented baseline

- `src/lib/api-error.ts` exposes `ApiError` with four kinds: `network`, `http`,
  `validation`, and `unknown`. Normalization preserves existing instances and
  their occurrence IDs. Callers supply request/response validation phase;
  malformed HTTP error bodies receive `error-payload` phase with status kept.
  Transport and backend codes have explicit provenance. Axios and TanStack Query
  cancellation is recognized and retains its original error.
- `src/lib/api-client.ts` owns one Axios instance with credentials enabled. Its
  response interceptor normalizes rejected HTTP requests and emits 401 events;
  the request wrapper validates successful responses. Request declarations
  validate inputs, and the Instructions query forwards TanStack Query's signal.
  `src/lib/api-events.ts` coalesces concurrent 401 events until an application
  handler explicitly resets the episode. `ApiErrorEffects` now owns the visible
  notice under the router, using the Sonner-backed `NotificationProvider` and
  `useNotifications`.
- `src/lib/react-query.ts` disables query and mutation retries and window-focus
  refetching. `QueryCache` and `MutationCache` report unexpected failures once
  per failed execution; neither adds query toasts nor blanket `throwOnError`.
  The transport still owns authentication event dispatch.
- `src/lib/error-reporting.ts` exposes an injectable sanitized reporting adapter,
  development diagnostics, a silent production default, occurrence deduplication,
  and synchronous/asynchronous reporter-failure isolation. Instructions request
  validation now marks `requestOrigin: 'internal'`; operation metadata identifies
  status-qualified internal backend rejections without exporting backend text.
- Instructions queries show safe feature-owned Portuguese copy and retry. A
  failed background refresh retains valid data for the same key with a visible
  warning; placeholder data from another page or filter is hidden during the
  request and on failure. A 401 uses neutral inline copy; the shared notice
  owns authentication copy. Cancellation is silent.
- Active-state changes optimistically update, roll back on write failure,
  invalidate, and show a visible local error. Archive invalidates after success,
  keeps its dialog open with a visible local error on write failure, and closes
  after a confirmed write. Follow-up callback/refetch failures are caught,
  safely reported, and described as follow-up failures rather than write failures.
- `AppProvider` wraps provider creation in `ApplicationErrorBoundary`. The root
  route uses `RouteErrorFallback`; features may use `SectionErrorBoundary` to
  isolate a region. These fallbacks use safe Portuguese copy and explicit resets.
- `main.tsx` invokes the dependency-free `bootstrap.ts` guard before dynamically
  importing `app/start.tsx`. Environment, provider, route, React, and CSS imports
  are inside that guard. A DOM fallback handles import and mock initialization
  failures before React mounts, even if reporting cannot load.

Shared mutation feedback metadata is an optional future integration. The current
Instructions UI owns its local mutation feedback explicitly.

## Error categories and classification

Keep the four existing `ApiError.kind` values. Authentication is a policy based
on HTTP status; cancellation is control flow. Neither requires another public
API-error kind. `ValidationPhase` is `request`, `response`, `error-payload`, or
`environment`; classification never depends on message text.

| Category                 | Required treatment                                                                                                                                                                                         | Expected or unexpected                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Network                  | No HTTP response, including transport timeout. Preserve a safe transport code. Do not assert the user is offline solely from this classification.                                                          | Expected operational failure.                                                                           |
| HTTP                     | Non-success response with a validated optional `{ message, code? }` payload. Preserve status and distinguish backend codes from Axios transport codes.                                                     | Known business rejection is expected; an unexplained server failure is unexpected operational behavior. |
| Request validation       | Invalid input must fail before transport or optimistic cache changes. Record phase `request`.                                                                                                              | Expected for editable user input; unexpected when application-generated input violates its own schema.  |
| Response validation      | A successful HTTP response that fails its schema must not enter the cache as successful data. Record phase `response`.                                                                                     | Unexpected contract failure.                                                                            |
| Error-payload validation | A present but malformed error body is a contract failure. Preserve status and record phase `error-payload`; do not trust its message or code. An absent body remains an HTTP error.                        | Unexpected contract failure, even when the status also requires authentication handling.                |
| Authentication           | HTTP 401 requires the authentication event policy below, including when a malformed body produced `kind: validation`. HTTP 403 means forbidden unless a future documented backend contract says otherwise. | Expected session/access condition.                                                                      |
| Cancellation             | Detect deliberate Axios/TanStack Query cancellation before ordinary error normalization and feedback. Keep the library cancellation semantics intact.                                                      | Expected control flow, not a failed user operation.                                                     |
| Unknown/runtime          | Unclassified thrown values, programming errors, render failures, and invalid environment configuration. Use generic user copy and retain private diagnostic context.                                       | Unexpected.                                                                                             |

Expected errors still need appropriate feedback; unexpected errors additionally
need diagnostic reporting. A status code alone does not prove a client bug:
report unexplained 5xx failures, but report a 4xx as unexpected only when context
demonstrates a contract or programming failure. Instructions' invalid generated
pagination or patch body is such a failure.

Normalization MUST accept `unknown`, be idempotent for an existing `ApiError`,
and retain useful status/phase information. Feature code MUST supply context that
normalization cannot infer, especially whether request validation came from an
editable field or an internal invariant. `details`, `cause`, raw Axios config,
and schema issues MUST NOT become user-facing text.

## Feedback ownership

### Queries

The feature's query view MUST own recoverable query feedback. An initial failure
shows an inline error with an accessible announcement and an appropriate recovery
action; it must not masquerade as an empty result. A failed background refetch
SHOULD retain the last valid data for the same query key and display a visible
refresh warning. Previous-page placeholder data must not be presented as a
successful response for the new page or filter.

Query failures MUST NOT generate an additional global toast. Reporting an
unexpected query failure does not require throwing it into a render boundary:
the affected view can keep its own error state. Raw HTTP 404 for a list is not
an empty list or automatically a route-not-found state.

Synchronous schema validation while constructing query options can throw before
Query owns the operation. Validate editable inputs before that point and show
field feedback. An invalid internal query input goes to the nearest runtime
boundary and is reported as a request-contract failure.

### Mutations

Every failed, non-cancelled user mutation MUST produce visible, accessible
feedback identifying the failed action. A screen-reader-only announcement is
insufficient. Preserve user input and dialog context when the operation fails.

Each mutation MUST choose one feedback owner in its feature design: local
inline/dialog feedback or an application-owned visible notification. The current
template does not encode this choice as shared mutation metadata. A callback
used only for rollback, invalidation, or reporting does not claim feedback
ownership; inspecting whether `onError` exists is insufficient.

Instructions SHOULD use local feedback next to the active-state control and
inside the archive dialog. Error text must remain visible until dismissal,
correction, or a new attempt. Its accessible announcement must not be duplicated
by the existing page announcement channel.

Canonical cache behavior MUST survive consumer callbacks and feedback failures:
active-state rollback precedes failure presentation and list invalidation still
runs; archive invalidation follows successful response validation. A client-side
rollback is not proof the server reverted a write. A network timeout or malformed
success response may leave the server outcome uncertain. Copy must not claim
the write failed definitively, and users must not be encouraged to repeat an
unsafe write without reconciling state.

Handle `mutateAsync` rejections explicitly. Consuming a rejection to preserve a
dialog is valid only when the chosen feedback owner presents the error. A
callback or invalidation failure after a successful write MUST be reported as
a separate application/refresh failure, without saying the confirmed write
failed or inviting its automatic replay.

### Authentication events

A shared policy MUST recognize status 401 and emit an authentication-required
event to an application-owned handler. The transport MUST remain independent
of routing, notifications, translations, and session storage. Query/mutation
cache integration can dispatch the event through an injected callback.

The implemented handler is `ApiErrorEffects`, mounted once by the root route
below `RouterProvider`. It is the sole application subscriber to the shared
event channel. The channel replays an active episode to a late subscriber, and
the handler keeps one refresh promise for that episode so concurrent 401s and
StrictMode effect remounting do not duplicate recovery.

Recovery calls `POST /auth/refresh` with the current in-memory CSRF token while
the canonical session query retains the existing user and exposes
`recovering`. On success, it replaces the validated session, resets the active
episode, and refetches only active queries marked `meta.requiresAuth`. It never
replays a mutation or refetches a public query merely because recovery
succeeded. On failure, it makes the session anonymous, removes protected
queries, preserves public data, resets the episode, and shows exactly one
Sonner notification with safe static session-expired copy. A stable
episode-derived notice ID prevents duplicate notices.

Login and refresh requests suppress authentication publication, so their 401s
cannot recurse. A 403 uses ordinary forbidden feedback and never starts
refresh. Malformed 401 payloads additionally produce one contract report
without a second visible alert. Once an episode settles, later independent 401s
can start a new refresh.

## Backend codes and user messages

Zod validation confirms the shape of backend text, not whether it is suitable
for display. UI MUST use application-owned copy. Resolve authentication first,
then contract failures, then a feature mapping for a validated backend code and
its expected status, then shared status/category fallbacks. Do not display raw
server messages when a code is unknown or missing. Never interpret an Axios
transport code as a backend business code.

Instructions mappings belong in the Instructions feature. These existing mock
codes establish the initial mapping; copy can be refined while keeping meaning:

| Status and backend code     | User-facing meaning / example copy             | Recovery                                                                          |
| --------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| 404 `INSTRUCTION_NOT_FOUND` | “Esta instrução não está mais disponível.”     | Refresh the list; do not keep retrying the same record mutation.                  |
| 400 `INVALID_PAGINATION`    | “Não foi possível carregar esta página.”       | Reset to valid pagination; report if generated by application code.               |
| 400 `INVALID_PATCH_BODY`    | “Não foi possível enviar esta alteração.”      | Report the request-contract issue; do not ask users to fix a hidden request body. |
| Unknown or missing code     | A safe message for the action and HTTP status. | Only offer recovery appropriate to that status and operation.                     |

Shared fallbacks cover inability to reach the service, authentication required,
forbidden access, unavailable service, invalid data, and unexpected failure.
Use Portuguese copy in the current Instructions UI. A translation framework is
optional. Messages MUST NOT expose stack traces, schema internals, credentials,
request bodies, or backend diagnostic text.

## Render, route, and startup boundaries

The application MUST provide a render boundary around application composition
and a TanStack Router error fallback for route rendering/loading failures.
Shared fallback UI lives outside features; routes remain thin. The nearest
boundary owns presentation and reporting. It must offer a meaningful recovery
action such as resetting the failed view or reloading, without an automatic
reload loop or dependence on the failed data/provider.

Boundaries MUST show generic visible copy and report the unexpected failure
once. Expected query/mutation failures remain in the feedback paths above;
do not enable blanket `throwOnError` for all API failures. Route-not-found is a
separate expected route state.

Render boundaries do not replace explicit handling of event-handler promises,
startup failures, or module-initialization errors. Startup MUST have a minimal
visible failure path for environment validation and mock-worker initialization
failures. Its implementation must account for imports that can fail before
React mounts; merely wrapping `root.render` is insufficient. This fallback
must not import the same failing environment/provider to render itself.

## Retry, reporting, and duplicate prevention

### Reporting and recovery API

`errorReporting.configure({ reporter })` installs a host adapter accepting only
an immutable `ErrorReport`. Passing `reporter: undefined` restores the default.
`createErrorReporting({ reporter, development })` creates an isolated instance
for policy tests or another host. The environment module configures the shared
development flag before environment validation, so invalid configuration can
still produce sanitized diagnostics. Production makes no external delivery and
prints no default diagnostics. Adapters must be configured before the operations
they are intended to observe; installing one does not replay previous reports.

Reports include only a fixed source (`query`, `mutation`, `application`, `route`,
`section`, or `startup`), category (`contract`, `server`, or `runtime`), valid HTTP
status, validation phase, and allowlisted Zod issue codes. Message text, stack,
causes, issue paths/values, backend/transport codes, operation inputs, arbitrary
metadata, query keys, URLs, and Axios configuration are deliberately omitted.
Future additional diagnostic fields require an explicit sanitization policy.

`report(error, { source })` owns boundary reporting. Cache callbacks use
`reportExecution` to create a fresh occurrence on each failed execution, even
if a caller rethrows the same Error object. Weak identity tracking links later
boundary propagation to that occurrence, without retaining errors indefinitely
or deduplicating by text/status. `beginAttempt(error)` opens a fresh identity
before an explicit boundary reset. Raw primitive throws have no object identity;
the optional third `report` argument supplies a caller-owned occurrence token
(used for route effect replay). Managed API failures normalize to `ApiError`
objects; new integrations must preserve that object when propagating failures.

Request validation uses `requestOrigin: 'input' | 'internal'`; absent origin
defaults to expected input validation. Instructions' generated pagination, IDs,
and patch fields use `internal`. Shared cache policy also recognizes feature-owned
`meta.requestContractErrors: [{ status, code }]` only when the normalized error
is HTTP and the code has backend provenance. Instructions declares 400
`INVALID_PAGINATION` for its query and 400 `INVALID_PATCH_BODY` for its mutations.
Neither codes nor metadata are sent to the adapter. Ordinary 4xx, network, input
validation, and cancellation remain unreported. Response/error-payload contracts,
environment validation, unknown errors, and unexplained 5xx are reported.

The native React boundary adds no dependency. Its fallback needs no provider or
router, resets on an explicit click, and can contain provider initialization.
Application and route fallbacks also offer a full reload and a plain home link.
Section reset preserves mounted siblings. Route retry awaits `router.invalidate()`
before resetting the render boundary so failed loader state is actually retried;
reporting does not turn expected route-not-found states into exceptions.
`app/route-error.tsx` supplies that router callback; the shared route fallback
itself can render without any provider.
No fallback automatically reloads, resets, or retries a write.

The bootstrap fallback uses only DOM creation and constant text. It renders
before attempting a best-effort dynamic reporter import. The guard cannot cover
failure to download/execute the entry script itself, a disabled JavaScript
runtime, or a browser incapable of DOM operations.

Development mock startup remains inside this guarded path. Its dynamic import
is protected directly by the Vite-defined `__APP_DEVELOPMENT__` constant,
allowing the production build to eliminate the MSW module graph without another
environment reader. The build fails if mock modules still reach an emitted
chunk and removes the development worker from production output.

### Required baseline

- Keep automatic query and mutation retries disabled. Offer manual query retry
  for transient network/server failures; for contract failures show safe recovery
  copy without promising that another identical attempt will repair the data.
  Invalid input requires correction, and 401/403 must follow their access policy.
- Never retry cancellation, invalid input, schema failures, or unknown runtime
  failures automatically. Never automatically replay a write without a proven
  idempotency contract. Mutation cancellation does not guarantee server rollback.
- When an operation supports cancellation, pass its signal through the feature
  request to Axios. Deliberate cancellation must produce no error notice, auth
  event, failure report, or retry. Merely cancelling a Query cache entry does not
  establish that its HTTP request was aborted. Adding cancellation controls to
  every operation is optional; correct classification is required.
- Provide a vendor-neutral reporting function with an injectable adapter.
  Report unexpected contract/runtime failures and unexplained 5xx failures.
  Expected validation, business rejection, network failure, authentication, and
  cancellation do not produce exception reports by default.
- Use a sanitized development diagnostic adapter and a safe no-op production
  default until a host installs a reporter. Production external delivery is
  optional; invoking and testing the reporting seam for unexpected failures is
  mandatory. A reporter exception must not break recovery or recursively report
  itself.
- Current reports contain only fixed source/category, valid HTTP status,
  validation phase, and allowlisted schema issue codes. Do not serialize entire
  errors, query keys, Axios config, payloads, field values, headers, cookies,
  URLs, stacks, or causes. Any new field requires explicit sanitization policy.
- Shared query/mutation cache policy owns reporting of managed operations, once
  per failed execution after any permitted attempts. It must not report once
  per observer or component render. Boundaries own errors outside managed
  operations; startup owns errors before mount.
- Carry or track an occurrence identity through normalization, cache handling,
  and boundaries to prevent the same failure from being reported twice. A fresh
  explicit attempt is a new occurrence. Do not permanently deduplicate by text
  or status, which would hide later independent failures.
- Presentation and reporting are separate. One mutation must not trigger local
  copy plus a global toast; an inline query error must not trigger a toast;
  a cache-reported error reaching a boundary must not create another report.
  Rollback and invalidation are cache effects, not feedback owners.

### Optional enhancements

Bounded query retries with backoff MAY be added for explicitly documented
transient failures. That change requires status-aware tests, a retry limit, and
proof it cannot duplicate feedback/reports. Rate-limit recovery can be added
when a real backend defines its policy. Offline detection, telemetry sampling,
an external reporter, session recovery, and translation tooling are optional.
None may weaken the baseline ownership or safe-message rules.

## Structure and extension points

The table describes implemented extension points. A shared message module and
mutation feedback metadata remain possible later extensions; Instructions owns
its local feedback and safe code mapping.

| Location                                                                                        | Responsibility / extension point                                                             |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/lib/api-error.ts`                                                                          | Error model, pure normalization, cancellation recognition, validation context.               |
| `src/lib/api-client.ts`                                                                         | Axios transport and response/error-payload validation; no presentation effects.              |
| `src/lib/api-events.ts`                                                                         | Authentication-required event channel and explicit episode reset; no application policy.     |
| `src/lib/react-query.ts`                                                                        | Query defaults, cache-level reporting, and request-contract metadata.                        |
| `src/lib/error-reporting.ts`                                                                    | Vendor-neutral reporting contract, sanitization, occurrence deduplication.                   |
| `src/components/errors/`                                                                        | Domain-neutral visible feedback and boundary fallback components.                            |
| `src/app/provider.tsx`                                                                          | Wrap provider creation in the application boundary; compose Query and notifications.         |
| `src/lib/notifications.ts`, `src/components/notifications/`, and `src/components/ui/sonner.tsx` | Shared notification controls and Sonner-backed accessible visible surface.                   |
| `src/app/`                                                                                      | Application-owned authentication-event coordination and reporter configuration.              |
| `src/main.tsx`, `src/bootstrap.ts`, `src/app/start.tsx`, and `src/routes/__root.tsx`            | Guarded startup import, DOM fallback, React mounting, and thin router fallback wiring.       |
| `src/features/instructions/api/`                                                                | Request context, supported cancellation, hook feedback ownership, existing cache guarantees. |
| `src/features/instructions/model/`                                                              | Feature-owned backend-code mapping and operation recovery policy.                            |
| `src/features/instructions/components/` and `pages/`                                            | Inline query, control, and dialog feedback through hooks.                                    |
| Colocated tests and `src/mocks/`                                                                | Policy tests and deterministic MSW failures; shared test helpers stay in `src/test`.         |

Shared layers MUST NOT import features, app, or routes. App composition injects
application behavior into shared collaborators; feature-specific mappings stay
inside their feature. Components and routes continue to consume hooks rather
than calling transport or endpoint fetchers. Keep concrete module imports and
the repository's alias rules. Generated operations carry validation context,
query signals, reporting metadata, and cache/follow-up TODOs; see the
[API-layer generator policy](api-layer.md#generator-policy).

## Verification expectations

Focused tests MUST cover the relevant error categories, cancellation, safe
copy, feedback ownership, authentication coalescing, sanitized reporting and
occurrences, cache rollback or invalidation, follow-up failures after a
confirmed write, and boundary/startup recovery. Use MSW for HTTP-boundary
cases and policy/component tests for ownership and reporting. `bun run
check:api` enforces static invariants it can prove; review and focused tests
establish behavioral requirements. Run `bun run verify` before declaring
feature work complete.
