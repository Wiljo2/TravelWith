# TravelWith — rules for working in this repo

Read `GUIDELINES.md` before large features. Operational summary:

## Language
- Code, comments, identifiers, commit messages, and docs: **always English**.
- End-user UI copy is currently Spanish.

## Architecture
- Next.js 16 App Router, but the app is a single client tree mounted from `app/page.tsx` → `src/App.tsx`.
- `App.tsx` composes domain hooks (`useItinerary`, `useBudget`, `useTasks`, `useTripInfo`, `useTripOps`, `useRoom`, `useDragDrop`) and passes everything down via props.
- Persistence: trip header in `rooms` columns, items in one table each (`trip_days`, `trip_events`, `trip_expenses`, `trip_tasks`, …, key `(room_code, id)`, per-row `version`). `rooms.payload` is a frozen backup: never write it.
- Writes: hooks update state optimistically and send one op per change (`useTripOps` → `POST /api/rooms/[code]/ops`); 409 = stale version, adopt the returned row. Reads: `GET /api/rooms/[code]` (SQL `get_trip`).
- Realtime: Broadcast from database triggers on the private channel `trip:<code>` (`useTripChannel`); never `postgres_changes`.
- Backend only in `src/app/api/rooms/**`; the service role key is only used in `lib/supabase-server.ts`.
- Server-side writes go through the op registry `src/server/ops/*` (`runOp`): row validation in `src/server/domain/*Rows.ts`, version-guarded repositories in `src/server/repo/*`, multi-row changes as SQL functions. Never inline Supabase writes for trip data.
- AI assistant: `POST /api/rooms/[code]/agent` (SSE, manual tool loop, `@anthropic-ai/sdk`). `ANTHROPIC_API_KEY` server-only; model via `AGENT_MODEL` (default `claude-sonnet-5`); system prompt in `src/server/agent/prompt.ts` must stay byte-stable (prompt cache) — dynamic data flows through read tools.

## Hard rules (never break existing features)
- New columns on trip tables are nullable (or have a default) and the client fields are **optional**, with defaults applied at read time (`x.field ?? DEFAULT`). Never rename or repurpose an existing column or field.
- New state that must persist: migration (column + check), `src/types/database.ts`, row validator, op, `get_trip`, `utils/tripRows.ts`, and the hook's optimistic update + `applyRow` (checklist in `GUIDELINES.md` §2).
- SQL migrations: only new files in `supabase/migrations/`, additive only.
- `npx tsc --noEmit` must pass before considering anything done.

## Conventions
- Money math ONLY via `extraGroupUSD` / `extraPerPersonUSD` / `extraUnitUSD` (`utils/currency.ts`), always USD internally. `Extra.splitMode`: `"group"` = fixed total split across people; `"perPerson"` = unit cost that scales with people.
- Hours are decimal (14.5 = 2:30pm); format with `utils/time.ts`.
- Domain types in `src/types/index.ts`; enumerables in `src/constants/` as typed Records.
- Styling: Tailwind v4 + shadcn/ui. Theme tokens (`bg-card`, `text-muted-foreground`, `border-border`) over raw hex; shadcn primitives over hand-rolled elements. Inline `style` only for data-driven values (calendar positions, category colors). Theme lives in `globals.css` `:root`.
- No unnecessary comments.
- Imports use the `@/` alias instead of `../../..`.
- Editable rows follow the dirty + ✓/✕ pattern (see `GlobalExtraRow`).
- No file over ~400 lines — split into composed subcomponents.
