# TravelWith — Project Guidelines

Architecture and best-practices guide. Goal #1: **a new feature must never break existing ones**. If a change violates a rule in this document, justify it here (edit this file in the same PR).

Language rule: **code, comments, identifiers, commit messages, and docs are always in English.** UI copy shown to end users is currently Spanish.

---

## 1. Architecture map

```
src/
├── app/                  Next.js App Router
│   ├── page.tsx          Renders `EntryGate`: the server-rendered landing for anonymous visitors, `<App />` otherwise
│                         (decision in `components/landing/entry.ts`).
│   └── api/rooms/...     Route handlers (backend). The only place that touches Supabase with the service key.
├── App.tsx               Root composition: wires domain hooks to views. Global state lives here.
├── hooks/                One hook per domain: useItinerary (days/events/spans), useBudget (expenses),
│                         useTasks, useTripInfo (header/travelers), useTripOps (writes),
│                         useRoom (load + live changes via useTripChannel), useDragDrop, useAuth.
├── components/
│   ├── landing/          Public landing page and the EntryGate (landing vs app)
│   ├── calendar/         Grid, day columns, blocks, slot-create modal
│   ├── budget/           Budget view and side panel
│   ├── tasks/            Tasks view
│   └── editor/           Reusable editors
├── constants/            categories, taskCategories, time. Typed fixed values.
├── utils/                Pure functions (currency, time, styles, uid). No React, no state.
├── types/index.ts        ALL domain types live here.
├── lib/                  Supabase clients (browser and server), opQueue, schemas.
└── server/               Backend only: auth, op registry, row validators, repositories, agent.

supabase/migrations/      Versioned SQL. Only add new files; never edit applied ones.
```

**Data flow:** `App.tsx` owns state → flows down via props → children push changes up via callbacks → the domain hook updates its state optimistically and sends **one op** (`event.update`, `expense.create`, …) through `useTripOps` → `POST /api/rooms/[code]/ops` validates it and writes one row → a database trigger broadcasts the row on the private channel `trip:<code>` → every member's `useTripChannel` applies it by id (own echoes and stale versions are skipped). `GET /api/rooms/[code]` (SQL `get_trip`) loads the whole trip on open, after every (re)subscribe and when the tab becomes visible again.

---

## 1b. Entities and relations

A **room IS a trip** (1:1). The trip header lives in `rooms` columns; every kind of item has its own table keyed by `(room_code, id)`; membership is relational. The client still works with the `RoomPayload` shape: `get_trip` assembles it from the tables.

```
auth.users (Supabase Auth)
   │ 1:N
user_rooms (user_id, room_code, role owner|member, joined_at)   ← relational membership
   │ N:1
rooms (code PK, name, destination, start_date, end_date, exchange_rate, members JSONB,
       idea_places JSONB, idea_plan JSONB  ← idea settings, last write wins
       payload JSONB ← frozen pre-cut-over backup, never written by the app)
   ├── trip_days          (id, position, label, sub, flexible)
   │     ├── trip_events      (day_id → trip_days; maps_url; document_id → trip_documents)
   │     │     └── trip_event_places (id = event id; data = EventPlace)
   │     └── trip_day_spans   (day_id; start/end_event_id → trip_events)
   ├── trip_spans         (start/end_event_id → trip_events, cross-day)
   ├── trip_expenses      (linked_event_id → trip_events, start/end_day_id → trip_days, document_id)
   ├── trip_tasks         (day_id → trip_days when scheduled)
   │     └── trip_task_options
   ├── trip_travelers     (mockPeople in the client)
   ├── trip_documents     (drive_file_id, title, kind)
   ├── trip_ideas         (data = the Idea without its id)
   └── trip_changes       (audit log: table, row, op, before, after, user)

Every item row has version (int), updated_at and updated_by.
Ideas, documents, map places and the idea settings are sent by diffing each
collection against what the server last confirmed (useFeatureSync), not by an
op per function.
```

Notes and known trade-offs:
- **Membership is stored twice**: `rooms.members` (JSONB — display cache with name/avatar) and `user_rooms` (relational — source of truth for access and "my trips"). Both change only through the SQL functions `join_room` / `leave_room` / `delete_room` (`006_membership_functions.sql`, called via `src/server/members.ts`), which update them in one transaction; do not write either directly, and do not add a third representation. Roles are assigned by the server: the creator is `owner` (in `POST /api/rooms`), everyone who joins is `member`.
- The trip header (`name`, `destination`, dates, `exchange_rate`) is written only by the `trip.update` / `trip.setExchangeRate` ops; it has no row version (last write wins).
- References between items are **foreign keys** (`008_trip_tables.sql`): deleting an event nulls `linked_event_id` and day-span event ids and deletes the trip spans that start or end on it; deleting a day deletes its events and day spans and nulls expense and task day ids. New data has no dangling ids. Consumers still handle a missing reference gracefully (`find(...) ?? null`).
- New rooms are **built server-side** in `POST /api/rooms`: header columns plus empty days in `trip_days` (via `reset_itinerary`). Client hooks start empty; the fictional demo trip (`src/data/mockRoom.ts`) is loaded with a dynamic import only in the `LOCAL` room in development builds, so it never ships to production. Never put real trip data in app code or anything the client bundle imports (the idea-matching tests use the fixture `src/test/fixtures/initialDays.ts`, test-only).
- `rooms.payload` is the backup from before the cut-over: never write it from the app. `private.rebuild_payload(code)` regenerates it from the tables for a rollback. The cut-over ran on 2026-10-09; production reads and writes only the tables. `validateRoomPayload` (`lib/validate.ts`) checks payload-shaped JSON that the client sends (local mode, offline snapshots).
- Event categories: new events use `DEFAULT_EVENT_CAT`; pickers, the legend and the agent list `EVENT_CATEGORY_KEYS`. Legacy keys (`barco`, `puerto`, `miami`) stay in `CATEGORIES` so stored events render — never remove a category key.

### Server domain layer (`src/server/`)

Server-side mutations do NOT talk to Supabase directly. The layering is:

- `src/server/ops/*` — the **op registry** (`runOp(name, ctx, args)`): one entry per write (`event.create`, `task.chooseOption`, …, 28 today), each with its `minRole`. The only way to change trip data: the ops route and the agent both call it. Any future feature that writes trip data (REST endpoints, agents, cron) adds an op — never inline Supabase writes.
- `src/server/domain/*Rows.ts` — **pure validation** of op arguments into rows (`DomainError` with an actionable message; no I/O, unit-tested). `domain/read.ts` builds the agent's compact read views from a `RoomPayload`.
- `src/server/repo/*` — one module per table. Updates and deletes are **version-guarded** (`... and version = expected`): 0 rows → `RowConflictError` carrying the current row (409). Multi-row changes are SQL functions called with `rpc` (`swap_days`, `reset_itinerary`, `choose_task_option`, `get_trip`), so they are atomic.
- `src/server/agent/*` — the Claude assistant: tool definitions + executor (`tools.ts`, thin wrappers over `runOp` and `getTrip`) and the stable system prompt (`prompt.ts`).

### AI assistant (Claude agent)

- Endpoint: `POST /api/rooms/[code]/agent` — SSE stream (`text` deltas, `tool` activity, `done` usage, `error`). Manual tool-use loop (max 15 iterations), model from `AGENT_MODEL` env (default `claude-sonnet-5`), adaptive thinking, no sampling params.
- Beta access rules: owner only (`requireMember(..., "owner")`, and the UI hides the tab for others); per-user daily token quota from `AGENT_DAILY_TOKEN_LIMIT`, recorded in `agent_usage` (`src/server/agent/usage.ts`); destructive tools (`delete_event`, `delete_task`, `remove_expense`, `set_exchange_rate`) are excluded from `AGENT_TOOLS` and refused by `executeTool` unless `AGENT_DESTRUCTIVE_TOOLS=on`. The model call receives `req.signal`, so a closed panel stops generation.
- `ANTHROPIC_API_KEY` lives **only** on the server (env). Never send it to, or accept it from, the browser.
- Agent rules: read tools (`get_trip_overview`, `get_day_detail`, `get_budget`) ground the model before writes; write tools run one op each (same validation and version guards as the UI), so every member sees each change live over Broadcast; validation failures return `is_error` tool results (the model self-corrects) instead of throwing.
- Tool schemas do **not** use `strict: true`: Anthropic caps total optional parameters across all `strict` tools in one request at 24, and our edit-style tools (`update_task`, `update_expense`, `update_event`, …) intentionally have many optional fields by design. Domain-layer validation (`DomainError` → `is_error`) is the real validation boundary; don't re-add `strict: true` without first checking the combined optional-param count across `AGENT_TOOLS`.
- The system prompt must stay **byte-stable** (it carries a `cache_control` breakpoint): dynamic trip data reaches the model via read tools, never by interpolating state into the prompt.
- Chat history is ephemeral client state — never persist conversations into the room payload.

### API surface (Next.js route handlers)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/rooms` | Create trip (authenticated): validates `{name, destination?, startDate, endDate}`, generates days, inserts room with a random 10-char code, makes the caller owner |
| GET | `/api/rooms/list` | Authenticated: trips of the current user (joins `user_rooms` + `rooms`, returns names) |
| GET | `/api/rooms/[code]` | Trip in `RoomPayload` shape assembled from the tables (`get_trip`), every item with its `version`, plus members |
| POST | `/api/rooms/[code]/ops` | One write `{ op, args, expectedVersion? }` (member; `itinerary.reset` owner only). 200 `{ changed, deleted, trip? }`; 400 invalid; 404 gone; 409 `{ table, current }` on a stale version; 503 in maintenance. Body ≤ 32 KB |
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

Trip data lives in the `trip_*` tables; rows migrated from old payloads keep their legacy values (old categories, missing optional fields, nulls), and clients may be one deploy behind. Therefore:

1. **New column = nullable (or with a default).** Never add a `not null` column without a default to a trip table; the matching client field is optional (`Extra.splitMode?`, `Task.dayId?`, `Task.priority?`).
2. **Default at read time, not in the data.** Consumers apply the default (`extra.splitMode ?? "group"`, `task.cat ?? DEFAULT_TASK_CAT`). No data migrations to backfill defaults.
3. **Never rename or repurpose an existing column or field.** If the meaning must change, add a new one and keep reading the old one as fallback.
4. **Incoming data is untrusted**: `parseTripMessage` ignores unknown tables and malformed messages, row helpers (`utils/tripRows.ts`) tolerate nulls, and `useRoom` checks collections with `Array.isArray`.
5. **SQL migrations are additive only:** `create table if not exists`, `add column if not exists`. Never `drop` or `alter type` on production data without a rollback plan. A new trip table gets RLS, the audit and broadcast triggers, and a `(room_code, id)` key.
6. A new field touches: the migration (column + check mirroring `LIMITS`), `src/types/database.ts`, the row validator in `domain/*Rows.ts`, `get_trip`, `utils/tripRows.ts`, the client type, and `trip_payload` (used by `rebuild_payload`) if it must survive a rollback.
7. Before merging a feature that touches trip data, test: **open a trip created before the change** and verify it loads and edits without errors.

---

## 3. Frontend

### State and hooks
- **One hook per domain** in `src/hooks/`. A new domain (e.g. voting) gets its own hook — not code inside `App.tsx` or another hook.
- `App.tsx` only **composes**: it wires hooks to views. A function growing past ~15 lines there probably belongs in a hook.
- Derived values that span domains (e.g. `grandTotal` = extras × people) are computed in `App.tsx` with `useMemo`, not inside a single-domain hook.
- Anything that must persist is written with an op: the hook updates state optimistically and calls `send(op, args)` (`useTripOps`), and exposes `applyRow` so 409s and Broadcast messages can replace one item. Text the server rejects when empty (titles, labels, names) stays local until it has content (`sendable`).
- Never apply a remote row to an item with pending ops: `OpQueue.acceptRemote` decides, and the version guard settles the race with a 409 + Spanish notice.

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

- **The service role key never leaves the server.** Only `lib/supabase-server.ts` uses it, and only from route handlers. The browser uses `lib/supabase.ts` (anon key) solely for auth and the private Broadcast channel.
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
- Concurrency is **per item**: each row carries `version`; a stale update or delete gets 409 with the current row and the client adopts it. Two members editing different items never conflict. The trip header (`rooms` columns) is last-write-wins.
- Realtime is **Broadcast from the database** on the private channel `trip:<code>`: trip tables use `realtime.broadcast_changes` (trigger `private.broadcast_trip_change`), `rooms` uses `realtime.send` with only the header and roster (never `payload`). Receiving is authorized by the `select` policy on `realtime.messages`; clients never send. Broadcast is not durable, so clients refetch after every subscribe. Trigger functions live in schema `private` (the `realtime` schema is locked). Don't reintroduce `postgres_changes`.
- Every trip row change is audited in `trip_changes` by trigger (bulk loads with `app.bulk_load = 'on'` are skipped). Retention is not scheduled yet.
- `MAINTENANCE_MODE=on` answers every write route with 503; clients keep their ops and retry. Used for the cut-over and future data migrations.
- The permissive `rooms` policies from `001_init.sql` are still `using (true)`, but `005_rls_lockdown.sql` adds restrictive policies on top: browser clients (anon key, signed in or not) can only read/write rooms they are members of, and cannot insert or delete `user_rooms` rows. Route handlers use the service role and bypass RLS, so **every route must enforce membership itself**. Never add a permissive policy that widens this, and never grant clients direct writes to `user_rooms`.

---

## 5. Definition of Done for any feature

- [ ] `npx tsc --noEmit` passes.
- [ ] New persisted fields are optional with defaults applied at read time.
- [ ] New state is written with an op, applied from Broadcast (`applyRow`), and returned by `get_trip`.
- [ ] Full cycle tested: create → reload the page → the data is still there; a second account sees the change live.
- [ ] Tested in the `LOCAL` room (no Supabase) — the app must not depend on connectivity.
- [ ] If it touches money: tested with USD and COP, and with 1, 2, and 3+ people (group and per-person modes).
- [ ] If it touches the calendar: tested with overlapping events and at the edges (6am / 2am).
- [ ] No shared callback signature changed without updating every caller.
- [ ] Unit tests updated/added for any pure util that changed.

---

## 6. Tech-debt backlog (suggested order)

1. ~~Unit tests for `utils/currency.ts` and `utils/time.ts`~~ (done — see `src/utils/__tests__/`).
2. ~~Migrate deep relative imports to the `@/` alias~~ (done).
3. ~~Schema validation (zod)~~ (done — limits in `src/constants/limits.ts`, mirrored by the trip tables' check constraints and the row validators).
4. ~~Concurrent-save protection~~ (done — per-item versions, 409 with the current row).
5. `BudgetPanel` takes ~25 props: consider splitting into connected subcomponents or a room context.
6. Translate remaining Spanish UI copy if the product ever targets English-speaking users.
