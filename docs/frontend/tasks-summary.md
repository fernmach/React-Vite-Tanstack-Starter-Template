# Frontend delivery and implementation plan

Implementation-plan approval: **approved**

> Specification approval does not approve this implementation plan.

## Delivery stories

### `access-public-instructions`

As Visitante da área de instruções, Acessar uma área pública de instruções claramente identificada..

- /instrucoes opens without authentication and shows the product identity, Homologação text, active Instruções navigation, Portuguese page title, and Nova Instrução action.

- The title action stacks on narrow screens; focus follows the visual order and remains visible; text and controls meet WCAG 2.2 AA contrast.

### `find-and-review-instructions`

As Visitante da área de instruções, Pesquisar, percorrer e examinar instruções em qualquer tamanho de tela..

- Search trims a term of at most 200 characters, matches code or description, returns to page one, supports Enter, and Clear restores all results and field focus.

- Pagination preserves the term, exposes current and unavailable controls, reports the actual range and total, and announces result counts after search, clear, or page changes.

- Desktop uses a compact semantic table with the approved columns and alternating rows; below 768 px equivalent cards retain code, description, state, actions, and expandable URL details.

- Loading, empty, validation, runtime-error, and offline states are distinguishable and provide recoverable Portuguese guidance.

### `begin-create-or-edit`

As Visitante da área de instruções, Iniciar a criação ou edição da instrução escolhida..

- Nova Instrução starts the reserved creation destination, while each Editar action carries the selected stable identifier and a row-specific accessible name.

- Both actions work from the keyboard without inventing fields for the unspecified destination screens.

### `change-active-state`

As Visitante da área de instruções, Alterar com segurança o estado ativo de uma instrução..

- A row-specific, keyboard-operable switch exposes its state without relying on color, disables duplicate input while saving, and announces success.

- A failed save restores the previous value and announces recoverable Portuguese guidance.

### `delete-instruction-safely`

As Visitante da área de instruções, Confirmar ou cancelar o arquivamento reversível de uma instrução..

- A row-specific Excluir action opens a focus-contained dialog identifying code and description and explaining the reversible effect.

- Cancel returns focus to its trigger; confirm prevents duplicates, archives the record, refreshes counts, and announces success or a recoverable failure.

### `supply-instruction-data`

As Visitante da área de instruções, Receber resultados e concluir ações através de uma fronteira substituível..

- The boundary supplies stable identifier, code, description, URL, active state, pagination metadata, and distinct success, runtime-error, and offline outcomes.

- Search, paging, active-state changes, and reversible archive remain testable locally until the live contract is known.

## Implementation sequence

- Wave 1: `build-public-shell`, `define-data-boundary`, `install-list-primitives`
- Wave 2: `build-list-experience`
- Wave 3: `add-row-maintenance`

## Implementation tasks

### Install official list primitives (`install-list-primitives`)

Add the missing primitives through the configured shadcn registry.

Kind: `component-installation`. Priority: `critical`. Stories: find-and-review-instructions, change-active-state, delete-instruction-safely. Depends on: none.

Verification: `build`.

Components: `table-primitive` (install, official-available), `switch-primitive` (install, official-available), `pagination-primitive` (install, official-available), `alert-dialog-primitive` (install, official-available).

### Define the instructions data boundary (`define-data-boundary`)

Isolate the UI from the unknown service and make every state deterministic.

Kind: `data-boundary`. Priority: `critical`. Stories: supply-instruction-data. Depends on: none.

Verification: `unit-test`, `build`.

### Build the public instructions route and shell (`build-public-shell`)

Replace the starter navigation with the approved identity, route, and maintenance handoffs.

Kind: `user-visible`. Priority: `high`. Stories: access-public-instructions, begin-create-or-edit. Depends on: none.

Verification: `unit-test`, `browser`, `visual`, `build`.

Components: `button-primitive` (reuse, installed).

### Build searchable responsive results and pagination (`build-list-experience`)

Deliver all query states, equivalent desktop and mobile results, and retained-filter pagination.

Kind: `user-visible`. Priority: `high`. Stories: find-and-review-instructions. Depends on: install-list-primitives, define-data-boundary, build-public-shell.

Verification: `unit-test`, `browser`, `visual`, `build`.

Components: `button-primitive` (reuse, installed), `input-primitive` (reuse, installed), `table-primitive` (compose, official-available), `pagination-primitive` (compose, official-available).

### Add active-state and reversible-delete actions (`add-row-maintenance`)

Complete safe row maintenance with optimistic feedback, confirmation, focus control, and recovery.

Kind: `user-visible`. Priority: `high`. Stories: change-active-state, delete-instruction-safely. Depends on: build-list-experience.

Verification: `unit-test`, `browser`, `visual`, `build`.

Components: `switch-primitive` (compose, official-available), `alert-dialog-primitive` (compose, official-available).

## Coverage

- Specification targets covered: 72
- Specification targets deferred: 0
- Stories mapped: 6
- Stories deferred: 0

## Risks

- **The live instructions service contract, persistence, and error semantics are not specified.
  ** Mitigation: Define a typed replaceable boundary and verify all behavior with a local implementation until the live contract is supplied.

## Open questions

- None recorded.

## Anticipated paths

- `src/components/ui/table.tsx` — proposed (install-list-primitives)
- `src/components/ui/switch.tsx` — proposed (install-list-primitives)
- `src/components/ui/pagination.tsx` — proposed (install-list-primitives)
- `src/components/ui/alert-dialog.tsx` — proposed (install-list-primitives)
- `src/features/instructions/instructions.types.ts` — proposed (define-data-boundary)
- `src/features/instructions/instructions.service.ts` — proposed (define-data-boundary)
- `src/features/instructions/instructions.fixture.ts` — proposed (define-data-boundary)
- `src/features/instructions/instructions.service.test.ts` — proposed (define-data-boundary)
- `src/routes/__root.tsx` — existing (build-public-shell)
- `src/routes/instrucoes.tsx` — proposed (build-public-shell)
- `src/components/mobile-nav.tsx` — existing (build-public-shell)
- `src/components/instructions/instructions-shell.tsx` — proposed (build-public-shell)
- `src/components/instructions/instructions-shell.test.tsx` — proposed (build-public-shell)
- `src/routes/instrucoes.tsx` — proposed (build-list-experience)
- `src/features/instructions/instructions-search.tsx` — proposed (build-list-experience)
- `src/features/instructions/instructions-results.tsx` — proposed (build-list-experience)
- `src/features/instructions/instruction-card.tsx` — proposed (build-list-experience)
- `src/features/instructions/instructions-pagination.tsx` — proposed (build-list-experience)
- `src/features/instructions/instructions-search.test.tsx` — proposed (build-list-experience)
- `src/features/instructions/instructions-results.test.tsx` — proposed (build-list-experience)
- `src/features/instructions/instructions-pagination.test.tsx` — proposed (build-list-experience)
- `src/features/instructions/instruction-active-switch.tsx` — proposed (add-row-maintenance)
- `src/features/instructions/delete-instruction-dialog.tsx` — proposed (add-row-maintenance)
- `src/features/instructions/instructions-results.tsx` — proposed (add-row-maintenance)
- `src/features/instructions/instruction-active-switch.test.tsx` — proposed (add-row-maintenance)
- `src/features/instructions/delete-instruction-dialog.test.tsx` — proposed (add-row-maintenance)
