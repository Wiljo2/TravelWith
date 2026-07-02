# TravelWith — Project Guidelines

Architecture and best-practices guide. Goal #1: **a new feature must never break existing ones**. If a change violates a rule in this document, justify it here (edit this file in the same PR).

Language rule: **code, comments, identifiers, commit messages, and docs are always in English.** UI copy shown to end users is currently Spanish.

---

## 1. Architecture map

```
src/
├── app/                  Next.js App Router
│   ├── page.tsx          Only mounts <App /> (client). No logic here.
│   └── api/rooms/...     Route handlers (backend). The only place that touches Supabase with the service key.
├── App.tsx               Root composition: wires domain hooks to views. Global state lives here.
├── hooks/                One hook per domain: useItinerary (days/events), useBudget (expenses),
│                         useRoom (persistence + realtime), useDragDrop, useAuth.
├── components/
│   ├── calendar/         Grid, day columns, blocks, slot-create modal
│   ├── budget/           Budget view and side panel
│   ├── tasks/            Tasks view
│   └── editor/           Reusable editors
├── constants/            categories, taskCategories, time. Typed fixed values.
├── utils/                Pure functions (currency, time, styles, uid). No React, no state.
├── types/index.ts        ALL domain types live here.
└── lib/                  Supabase clients (browser and server).

supabase/migrations/      Versioned SQL. Only add new files; never edit applied ones.
```

**Data flow:** `App.tsx` owns state → flows down via props → children push changes up via callbacks → a debounced `useEffect` (600ms) PATCHes the full payload to `/api/rooms/[code]` → Supabase Realtime notifies other members → `onRemoteUpdate` replaces local state (`skipSave` prevents echo re-saves).

---

## 2. Compatibility: the golden rule

All trip state is stored as **a single JSONB `payload`** in the `rooms` table. Old rooms carry old payloads. Therefore:

1. **New field = optional field.** Never add a required field to a persisted type (`Day`, `CalendarEvent`, `Extra`, `Task`, `TripSpan`, `RoomPayload`). Applied examples: `Extra.splitMode?`, `Task.dayId?`, `Task.priority?`.
2. **Default at read time, not in the data.** Consumers apply the default (`extra.splitMode ?? "group"`, `task.cat ?? DEFAULT_TASK_CAT`). No data migrations to backfill defaults.
3. **Never rename or repurpose an existing field.** If the meaning must change, add a new field and keep reading the old one as fallback.
4. **`onRemoteUpdate` and `RoomPayload` validate with `Array.isArray`** before setting each new collection. An old payload without `tasks` must not crash the app.
5. **SQL migrations are additive only:** `create table if not exists`, `add column if not exists`. Never `drop` or `alter type` on production data without a rollback plan.
6. Before merging a feature that touches persisted types, test: **open a room created before the change** and verify it loads and saves without errors.

---

## 3. Frontend

### State and hooks
- **One hook per domain** in `src/hooks/`. A new domain (e.g. voting) gets its own hook — not code inside `App.tsx` or another hook.
- `App.tsx` only **composes**: it wires hooks to views. A function growing past ~15 lines there probably belongs in a hook.
- Derived values that span domains (e.g. `grandTotal` = extras × people) are computed in `App.tsx` with `useMemo`, not inside a single-domain hook.
- Anything that must persist has to be in `App.tsx`'s `save(...)` object **and** in `onRemoteUpdate`. Checklist when adding state: type in `RoomPayload` → `save({...})` → `onRemoteUpdate` → autosave `useEffect` deps.

### Types and constants
- All domain types in `src/types/index.ts`. No duplicated domain interfaces inside components (component prop interfaces do live next to the component).
- Enumerable values (categories, priorities, colors) go in `src/constants/` as a typed `Record` plus an exported default (`DEFAULT_TASK_CAT`). Components never hardcode a category key.

### Business logic
- **Math lives in `src/utils/` as pure functions**; components only call them. All money math goes through `extraGroupUSD` / `extraPerPersonUSD` / `extraUnitUSD` in `utils/currency.ts`. If a component starts doing `amount / people` by hand, that's wrong — use the helper (that's exactly how the group-vs-per-person expense bug was born).
- All money math happens **in USD**; convert to COP only for display.
- Hours are decimal (`14.5` = 2:30pm), same as `CalendarEvent`. Format only with `fmtHour`/`durLabel` from `utils/time.ts`.

### Components
- Table-editing convention: local state + `dirty` flag + ✓/✕ commit/cancel buttons (see `GlobalExtraRow`). New editing features follow this pattern.
- Inline styles with CSS variables (`var(--surface-2)`, `var(--border)`, …). This is the project idiom: don't half-introduce CSS modules or styled-components; if it ever migrates, migrate fully.
- No unnecessary comments — only state constraints the code can't express.
- Use the `@/` alias (configured in tsconfig) instead of deep relative imports (`../../../../../lib`).

### Don't break what exists
- Don't change a shared callback signature (`onAddEvent`, `onUpdateExtra`, …) without updating **all** callers in the same commit; the typechecker is the guardian: `npx tsc --noEmit` must pass before every commit.
- If a feature needs a variant of a component, first extend via optional props; only fork the component when optional props make it unreadable.

---

## 4. Backend (API routes + Supabase)

- **The service role key never leaves the server.** Only `lib/supabase-server.ts` uses it, and only from route handlers. The browser uses `lib/supabase.ts` (anon key) solely for realtime and auth.
- Every route handler:
  1. Normalizes the room code with `.toUpperCase()` and validates its format.
  2. Validates the minimal body shape before writing, returning 400 with a message.
  3. Returns `{ error }` with the right status (400/401/404/409/500) — never throws uncaught.
- Mutation endpoints should be **idempotent** where possible (see POST members: already a member → `{ ok: true }`).
- Authenticated routes: token via `Authorization: Bearer` header, verified with `getUserFromToken`. Never trust a `userId` coming in the body.
- Schema changes = **new file** in `supabase/migrations/` with a sequential numeric prefix (`002_...`). Never edit an applied migration.

### Known backend debt (do not make it worse)
- Saving is **last-write-wins of the full payload**: two people editing simultaneously can overwrite each other. Mitigated by the debounce, realtime, and the `updated_at` conflict check (409). Any new collaborative feature must keep this in mind.
- The `rooms` RLS policies are open (`using (true)`): anyone with the code can write. Acceptable for the share-by-code model, but never store sensitive data in the payload.

---

## 5. Definition of Done for any feature

- [ ] `npx tsc --noEmit` passes.
- [ ] New persisted fields are optional with defaults applied at read time.
- [ ] New state travels in `save(...)` and is restored in `onRemoteUpdate`.
- [ ] Full cycle tested: create → reload the page → the data is still there.
- [ ] Tested in the `LOCAL` room (no Supabase) — the app must not depend on connectivity.
- [ ] If it touches money: tested with USD and COP, and with 1, 2, and 3+ people (group and per-person modes).
- [ ] If it touches the calendar: tested with overlapping events and at the edges (6am / 2am).
- [ ] No shared callback signature changed without updating every caller.
- [ ] Unit tests updated/added for any pure util that changed.

---

## 6. Tech-debt backlog (suggested order)

1. ~~Unit tests for `utils/currency.ts` and `utils/time.ts`~~ (done — see `src/utils/__tests__/`).
2. ~~Migrate deep relative imports to the `@/` alias~~ (done).
3. Schema validation (zod) for `PATCH /api/rooms/[code]` beyond the current shape checks.
4. ~~Concurrent-save protection (compare `updated_at`)~~ (done — 409 + refetch).
5. `BudgetPanel` takes ~25 props: consider splitting into connected subcomponents or a room context.
6. Translate remaining Spanish UI copy if the product ever targets English-speaking users.
