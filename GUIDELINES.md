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

**Data flow:** `App.tsx` owns state → flows down via props → children push changes up via callbacks → a debounced `useEffect` (600ms, gated on `connected`) PATCHes the full payload to `/api/rooms/[code]` → Supabase Realtime notifies other members → `onRemoteUpdate` replaces local state (`skipSave` prevents echo re-saves).

---

## 1b. Entities and relations

A **room IS a trip** (1:1). Everything about the trip lives in one JSONB payload; membership is relational.

```
auth.users (Supabase Auth)
   │ 1:N
user_rooms (user_id, room_code, role owner|member, joined_at)   ← relational membership
   │ N:1
rooms (code PK, name, payload JSONB, members JSONB, updated_at)
   └── payload: RoomPayload
        ├── trip?: TripInfo (name, destination?, startDate, endDate)
        ├── days: Day[] ─── events: CalendarEvent[]
        │                └─ spans?: DaySpan[]
        ├── extras: Extra[]        (money; linkedEventId → CalendarEvent, startDayId/endDayId → Day)
        ├── tripSpans: TripSpan[]  (startEventId/endEventId → CalendarEvent, cross-day)
        ├── tasks: Task[]          (dayId → Day when scheduled on the calendar)
        ├── mockPeople: MockPerson[]
        └── exchangeRate: number
```

Notes and known trade-offs:
- **Membership is stored twice**: `rooms.members` (JSONB — display cache with name/avatar) and `user_rooms` (relational — source of truth for access and "my trips"). Both change only through the SQL functions `join_room` / `leave_room` / `delete_room` (`006_membership_functions.sql`, called via `src/server/members.ts`), which update them in one transaction; do not write either directly, and do not add a third representation. Roles are assigned by the server: the creator is `owner` (in `POST /api/rooms`), everyone who joins is `member`.
- `rooms.name` is **denormalized** from `payload.trip.name` so trip listings don't fetch full payloads. The PATCH route keeps it in sync — never write it from anywhere else.
- References inside the payload are **by id across arrays** (e.g. `extra.linkedEventId` → an event inside some day). Deleting an event does NOT cascade; consumers must handle dangling ids gracefully (`find(...) ?? null`).
- New rooms get their initial payload **built server-side** in `POST /api/rooms` (empty days generated from the trip dates). Client hooks start empty; the fictional demo trip (`src/data/mockRoom.ts`) is loaded with a dynamic import only in the `LOCAL` room in development builds, so it never ships to production. Never put real trip data in app code or anything the client bundle imports (the idea-matching tests use the fixture `src/test/fixtures/initialDays.ts`, test-only), and keep autosave gated on `connected` so an empty or demo state can't overwrite a real trip.
- Event categories: new events use `DEFAULT_EVENT_CAT`; pickers, the legend and the agent list `EVENT_CATEGORY_KEYS`. Legacy keys (`barco`, `puerto`, `miami`) stay in `CATEGORIES` so stored events render — never remove a category key.

### Server domain layer (`src/server/`)

Server-side mutations do NOT talk to Supabase directly. The layering is:

- `src/server/domain/*` — **pure functions** `(payload, args) → { payload, result }` that validate and apply one change to a `RoomPayload`. They throw `DomainError` with an actionable message; no I/O, fully unit-tested. Any future feature that mutates trip state server-side (REST endpoints, agents, cron) goes through these functions — never inline Supabase writes.
- `src/server/trip-store.ts` — the only persistence gateway: `loadRoom`, `persistRoom` (name-column sync), and `mutateRoom` (read-modify-write with an `updated_at` guard + one retry, so server writes never clobber a member's concurrent autosave).
- `src/server/agent/*` — the Claude assistant: tool definitions + executor (`tools.ts`, thin wrappers over the domain functions) and the stable system prompt (`prompt.ts`).

### AI assistant (Claude agent)

- Endpoint: `POST /api/rooms/[code]/agent` — SSE stream (`text` deltas, `tool` activity, `done` usage, `error`). Manual tool-use loop (max 15 iterations), model from `AGENT_MODEL` env (default `claude-sonnet-5`), adaptive thinking, no sampling params.
- Beta access rules: owner only (`requireMember(..., "owner")`, and the UI hides the tab for others); per-user daily token quota from `AGENT_DAILY_TOKEN_LIMIT`, recorded in `agent_usage` (`src/server/agent/usage.ts`); destructive tools (`delete_event`, `delete_task`, `remove_expense`, `set_exchange_rate`) are excluded from `AGENT_TOOLS` and refused by `executeTool` unless `AGENT_DESTRUCTIVE_TOOLS=on`. The model call receives `req.signal`, so a closed panel stops generation.
- `ANTHROPIC_API_KEY` lives **only** on the server (env). Never send it to, or accept it from, the browser.
- Agent rules: read tools (`get_trip_overview`, `get_day_detail`, `get_budget`) ground the model before writes; write tools persist per-mutation via `mutateRoom` so Realtime shows live progress to all members; validation failures return `is_error` tool results (the model self-corrects) instead of throwing.
- Tool schemas do **not** use `strict: true`: Anthropic caps total optional parameters across all `strict` tools in one request at 24, and our edit-style tools (`update_task`, `update_expense`, `update_event`, …) intentionally have many optional fields by design. Domain-layer validation (`DomainError` → `is_error`) is the real validation boundary; don't re-add `strict: true` without first checking the combined optional-param count across `AGENT_TOOLS`.
- The system prompt must stay **byte-stable** (it carries a `cache_control` breakpoint): dynamic trip data reaches the model via read tools, never by interpolating state into the prompt.
- Chat history is ephemeral client state — never persist conversations into the room payload.

### API surface (Next.js route handlers)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/rooms` | Create trip (authenticated): validates `{name, destination?, startDate, endDate}`, generates days, inserts room with a random 10-char code, makes the caller owner |
| GET | `/api/rooms/list` | Authenticated: trips of the current user (joins `user_rooms` + `rooms`, returns names) |
| GET | `/api/rooms/[code]` | Room payload + members + `updated_at` |
| PATCH | `/api/rooms/[code]` | Save full payload built on `expectedUpdatedAt` (required). Atomic compare-and-swap in SQL; 409 + current state on conflict. Body ≤ 512 KB, validated by `lib/schemas.ts`; syncs `name` |
| DELETE | `/api/rooms/[code]` | Hard-delete for everyone. Authenticated + **owner only** (403 otherwise). Not wired in the UI |
| GET/POST/DELETE | `/api/rooms/[code]/members` | List / join (idempotent, authenticated) / **leave** |

### Deletion semantics (collaborative model)

A trip belongs to everyone who joined it. "Delete" in the UI always means **leave**: remove
the trip from *my* list (`user_rooms` row) and from the display roster (`rooms.members` JSONB,
so the person stops counting in per-person budget math). The room itself is only deleted by the
server **when the last member leaves** (garbage collection — no zombie rooms). The owner-only
hard DELETE endpoint exists as an explicit "delete for everyone" escape hatch but is not exposed
in the UI. Anyone can re-join later with the room code.

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
- **Styling: Tailwind v4 + shadcn/ui.** Use theme tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`) — never raw hex for foundational surfaces. shadcn primitives (`Button`, `Input`, `Textarea`, `Dialog`, `Badge`, `Checkbox`, …) before hand-rolled elements. Inline `style` is allowed **only** for data-driven values (computed positions in the calendar, category colors from `CATEGORIES`/`TASK_CATEGORIES` records). The theme lives in `globals.css` `:root` — the warm palette is mapped to shadcn tokens; change colors there, not in components.
- No unnecessary comments — only state constraints the code can't express.
- Use the `@/` alias (configured in tsconfig) instead of deep relative imports (`../../../../../lib`).
- No file over ~400 lines: split into composed subcomponents (see `components/budget/`).

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
- Authenticated routes: token via `Authorization: Bearer` header. Use `requireUser` / `requireMember(req, code, minRole?)` from `src/server/auth.ts`, never hand-parse the header. Every room-scoped route calls `requireMember` (the service role bypasses RLS, so this is the only access check). Never trust a `userId` or role coming in the body.
- Errors: wrap handlers in `try/catch` and return `errorResponse(e, context)` from `src/server/http.ts`. Throw `HttpError(status, message)` for user-facing errors; database and provider errors are logged and answered with a generic 500, never echoed.
- Client calls to room routes go through `apiFetch(path, accessToken, init)` (`src/lib/api.ts`).
- Schema changes = **new file** in `supabase/migrations/` with a sequential numeric prefix (`002_...`). Never edit an applied migration.

### Known backend debt (do not make it worse)
- Saving is **last-write-wins of the full payload**: two people editing simultaneously can overwrite each other. Mitigated by the debounce, realtime, and the `updated_at` conflict check (409). Any new collaborative feature must keep this in mind.
- `rooms.updated_at` is the payload's version: since `006_membership_functions.sql` the trigger only bumps it when `payload` changes (roster updates keep it), and clients skip reloading the payload when a Realtime row carries an unchanged `updated_at`. Don't bump it for non-payload columns.
- The permissive `rooms` policies from `001_init.sql` are still `using (true)`, but `005_rls_lockdown.sql` adds restrictive policies on top: browser clients (anon key, signed in or not) can only read/write rooms they are members of, and cannot insert or delete `user_rooms` rows. Route handlers use the service role and bypass RLS, so **every route must enforce membership itself**. Never add a permissive policy that widens this, and never grant clients direct writes to `user_rooms`.

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
3. ~~Schema validation (zod) for `PATCH /api/rooms/[code]` beyond the current shape checks~~ (done — `src/lib/schemas.ts`, limits in `src/constants/limits.ts`; when adding a persisted field, add it to the schema as optional/`nullish`, and to `LIMITS` if it's a string or list).
4. ~~Concurrent-save protection (compare `updated_at`)~~ (done — 409 + refetch).
5. `BudgetPanel` takes ~25 props: consider splitting into connected subcomponents or a room context.
6. Translate remaining Spanish UI copy if the product ever targets English-speaking users.
