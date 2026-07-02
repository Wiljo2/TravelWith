# TravelWith — rules for working in this repo

Read `GUIDELINES.md` before large features. Operational summary:

## Language
- Code, comments, identifiers, commit messages, and docs: **always English**.
- End-user UI copy is currently Spanish.

## Architecture
- Next.js 16 App Router, but the app is a single client tree mounted from `app/page.tsx` → `src/App.tsx`.
- `App.tsx` composes domain hooks (`useItinerary`, `useBudget`, `useRoom`, `useDragDrop`) and passes everything down via props.
- Persistence: all trip state is one JSONB `payload` in the `rooms` table (Supabase). Autosave debounced 600ms + Supabase Realtime for member sync.
- Backend only in `src/app/api/rooms/**`; the service role key is only used in `lib/supabase-server.ts`.

## Hard rules (never break existing features)
- New fields on persisted types (`Extra`, `Task`, `Day`, `CalendarEvent`, `TripSpan`, `RoomPayload`) are **always optional**, with defaults applied at read time (`x.field ?? DEFAULT`). Never rename or repurpose an existing field.
- New state that must persist: add it to `RoomPayload`, to `App.tsx`'s `save({...})`, to `onRemoteUpdate`, and to the autosave deps.
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
