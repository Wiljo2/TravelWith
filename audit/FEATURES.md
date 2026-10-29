# Feature Inventory

Audited at HEAD `9049c34`. "Persisted" lists `RoomPayload` fields (`src/hooks/useRoom.ts:10-18`) or tables. "Tests" lists vitest suites; UI has no tests.

## Rooms and identity

| Feature | User-facing description | Entry components | Hooks | API routes | Persisted | Tests | Known limitations |
|---|---|---|---|---|---|---|---|
| Sign in with Google | OAuth sign-in via Supabase; header avatar + sign-out | `RoomGate.tsx`, `auth/AuthButton.tsx` (in `AppHeader.tsx:78`) | `useAuth` (`useAuth.ts:27-35` `signInWithOAuth`, `redirectTo: window.location.origin`) | none (Supabase Auth direct) | Supabase `auth.users` | none | Google only. `AuthButton` calls `useAuth` separately from `App`, so two auth listeners. Anonymous users can still create rooms and edit any room by code. |
| Create trip | Name, optional destination, start/end dates; server generates empty days | `RoomGate.create()` (`RoomGate.tsx:66-91`) | `useUserRooms.addRoom` | `POST /api/rooms`, then `POST /api/rooms/[code]/members` `{role:"owner"}` | `rooms` row: `code`, `name`, `payload.{trip,days,extras,exchangeRate,mockPeople,tripSpans,tasks}` | `tripDays.test.ts` (day generation, `MAX_TRIP_DAYS = 60`) | Create is unauthenticated; owner role is claimed by the client afterward (SEC-API-002). Code is 6 chars from `Math.random`. |
| Join trip by code | Enter code; existence checked, then membership registered | `RoomGate.join()` (`RoomGate.tsx:49-63`) | `useUserRooms.addRoom` | `GET /api/rooms/[code]`, `POST /members` | `user_rooms` row, `rooms.members` JSONB entry | none | Anyone with the code joins; no invite, approval, or expiry. Anonymous users can open a room without joining (no auth on GET). |
| My trips list + auto-resume | Lists trips by `last_active_at`; auto-enters when exactly one | `RoomGate.tsx:160-190` | `useUserRooms` (`useUserRooms.ts:21-42`), `App.tsx:46-51` | `GET /api/rooms/list` | `user_rooms.last_active_at` (`003_user_rooms_last_active.sql`) | none | Requires service role key, silently empty otherwise (REL-001). |
| Leave trip / GC | "Delete" in UI means leave; last member out deletes room | `RoomGate.confirmDelete()` | `useUserRooms.removeRoom` | `DELETE /api/rooms/[code]/members` | removes `user_rooms` row and `rooms.members` entry; may delete `rooms` row | none | Rooms opened only anonymously have zero `user_rooms` rows and are never collected. |
| Hard delete for everyone | Owner-only escape hatch | not wired in UI | none | `DELETE /api/rooms/[code]` | deletes `rooms` + `user_rooms` | none | Owner role is self-assignable (SEC-API-002). |
| Members roster | Joined members shown; count drives per-person math | `BudgetView`, `TravelersCard` | `useRoom.members` | `GET /members`, via GET room and Realtime | `rooms.members` JSONB (column not in migrations, DX-001) | none | Display cache duplicated with `user_rooms`; no remove-member, no roles UI. |
| Leave room (session) | Header back button returns to gate | `AppHeader` `onLeaveRoom` | `App.tsx:254` | none | none | none | Client-only; does not remove membership. |
| Local mode `?local=1` | Offline demo room seeded from mock payload, no Supabase | `RoomGate` "local" button, URL param | `App.tsx:55-60`, `148-155` | none | none (LOCAL never saves, `useRoom.ts:41`) | none | Disabled in production (`mockRoom.ts:9` `NODE_ENV !== "production"`). Agent disabled in LOCAL (`AgentPanel.tsx:32`). |

## Collaboration and sync

| Feature | Description | Components | Hooks | API | Persisted | Tests | Limitations |
|---|---|---|---|---|---|---|---|
| Autosave | Every state change saved 600ms after last edit | `AppHeader` save indicator (`saveState`) | `App.tsx:169-181`, `useRoom.save` | `PATCH /api/rooms/[code]` with `expectedUpdatedAt` | full payload | none | Full-payload last-writer; check-then-write not atomic; on 409 local edits are discarded (`useRoom.ts:54-64`). |
| Realtime sync | Other members' saves appear live | none | `useRoom.ts:102-119` | Supabase Realtime `postgres_changes` on `rooms` | n/a | none | No presence, no "who changed what", no conflict indicator. |

## Calendar

| Feature | Description | Components | Hooks | API | Persisted | Tests | Limitations |
|---|---|---|---|---|---|---|---|
| Calendar grid | Day columns with hour gutter, 6am to 2am (decimal hours 6-26) | `calendar/CalendarGrid.tsx`, `DayColumn.tsx`, `HourGutter.tsx`, `EventBlock.tsx` | `useItinerary` | via autosave | `payload.days[].events[]` | none (domain tests cover server-side event rules only) | Horizontal layout only, desktop-oriented (fixed 300px side panel, `App.tsx:284`). |
| Create activity or task from slot | Click empty slot, modal to create activity or scheduled task | `SlotCreateModal.tsx` | `useItinerary.addEvent`, `App.addTask` | autosave | `days[].events[]`, `tasks[]` | none | Client `addEvent` default category `"miami"` (`useItinerary.ts:77`), trip-specific. |
| Event editor | Edit title, times, category, note with link chips; delete | `editor/EventEditor.tsx`, `budget/BudgetPanel.tsx`, `NewEventForm.tsx` | `useItinerary.updateEvent/deleteEvent` | autosave | `days[].events[]` | none | Deleting an event on the client does not unlink extras (server domain does, `domain.test.ts:49`). |
| Drag and drop with undo | Drag an event to another time/day; toast offers undo | `EventBlock`, `DayColumn`, `Toast.tsx` | `useDragDrop`, `useItinerary.moveEvent`, `App.tsx:194-210` | autosave | `days[].events[]` | none | Undo is local only and can revert a newer remote change. |
| Swap days | Drag a day header onto another to swap contents; tasks follow | `DayColumn.tsx:129-148` | `useItinerary.swapDays`, `App.swapDaysWithTasks` | autosave | `days`, `tasks[].dayId` | none | No undo. |
| Reset itinerary | Regenerates empty days from trip dates | `AppHeader` reset button | `App.tsx:247-253` | autosave | wipes `days`, `tripSpans` | none | Destroys all members' events with a `confirm()` only; scheduled tasks keep stale `dayId`s; no history (REL-002). |
| Day spans | Colored time ranges within a day, anchored to events or hours | `CalendarSpansCard.tsx`, `DayColumn` | `useItinerary.removeDaySpan/updateDaySpan` | autosave | `days[].spans[]` | none | `addDaySpan` exists but has no caller (`useItinerary.ts:126`); spans come only from seed data. |
| Trip spans | Cross-day colored ranges between two events (e.g. "on the ship") | `RangesSection.tsx`, `CalendarSpansCard.tsx` | `App.addTripSpan/removeTripSpan/updateTripSpan` | autosave | `tripSpans[]` | none | Not visible to the agent. |
| Note links | URLs in notes rendered as chips opening in new tab | `NoteLinks.tsx` (used by `EventEditor`, `TasksView`) | none | none | `note` fields | none | Regex `https?://` only (`linkify.ts:1`), `rel="noopener noreferrer"` present. XSS review in P7. |
| UI zoom | Whole UI scaled via CSS `zoom: var(--app-zoom)` = 0.85; pointer math corrected | `CalendarGrid`, `DayColumn`, `EventBlock`, `SlotCreateModal`, `ui/dialog`, `ui/select` | `utils/zoom.ts` | none | none | none | Global constant in `globals.css:102`; not user-adjustable. |

## Budget

| Feature | Description | Components | Hooks | API | Persisted | Tests | Limitations |
|---|---|---|---|---|---|---|---|
| Expenses (extras) | Global, per-day-range, or event-linked expenses; inline edit with dirty + check/cancel | `BudgetView`, `GlobalExtraRow`, `DayExtraRow`, `DayTimeline`, `LinkedExtrasSection`, `PriceChip` | `useBudget` | autosave | `extras[]` | `currency.test.ts`, `domain.test.ts` (extras) | No payer, no settlement. |
| Group vs per-person split | `splitMode` group total vs per-person unit cost | same | `utils/currency.ts` | autosave | `extras[].splitMode` | `currency.test.ts:39-70` | |
| Currency + exchange rate | USD internal, COP display, editable TRM (default 4000) | `BudgetView.tsx:61` | `useBudget.setExchangeRate` | autosave | `exchangeRate` | `currency.test.ts` | Only USD and COP hardcoded in types (`types/index.ts` `"USD" | "COP"`). |
| Per-person card | Per-person totals | `PerPersonCard.tsx` | `App.tsx:157-162` | none | derived | `currency.test.ts` | |
| Travelers | Real members + named placeholder travelers counted in headcount | `TravelersCard.tsx` | `App.addMockPerson/removeMockPerson` | autosave | `mockPeople[]` | none | Placeholders not linkable to accounts later. |

## Tasks

| Feature | Description | Components | Hooks | API | Persisted | Tests | Limitations |
|---|---|---|---|---|---|---|---|
| Task list | Backlog + scheduled tasks, category, priority, done, inline edit | `tasks/TasksView.tsx` | `App.addTask/toggleTask/updateTask/deleteTask` | autosave | `tasks[]` | `domain.test.ts` (tasks) | Task logic lives in `App.tsx`, not in a hook (GUIDELINES "one hook per domain"). No assignee. |
| Task options (decisions) | Candidate choices with costs; choosing one creates event + expense and removes the task | `TaskOptions.tsx`, `TaskPreviewCard.tsx` | `App.chooseTaskOption` (`App.tsx:102-122`) | autosave | `tasks[].options[]` | none | No voting; choice is irreversible; agent cannot edit options. |
| Calendar task blocks | Scheduled tasks rendered on the grid, toggle/edit | `calendar/TaskBlock.tsx` | `App.toggleTask`, `slotDraft` | autosave | `tasks[].dayId/start/end` | none | |

## AI assistant

| Feature | Description | Components | Hooks | API | Persisted | Tests | Limitations |
|---|---|---|---|---|---|---|---|
| Agent panel | Side-panel chat, SSE streaming, tool activity labels, example prompts, abort | `agent/AgentPanel.tsx` | local state in `App.tsx:66` | `POST /api/rooms/[code]/agent` | none (chat is ephemeral by design) | none | No auth, no quota (SEC-AI-001). History sent by client, including assistant turns. |

### Agent tools (`src/server/agent/tools.ts:20-170`)

| Tool | Kind | Domain function | Notes |
|---|---|---|---|
| `get_trip_overview` | read | `read.tripOverview` | Returns user-authored titles/notes to the model (injection surface, P6). |
| `get_day_detail` | read | `read.dayDetail` | |
| `get_budget` | read | `read.budgetDetail` | |
| `create_event` | write | `events.addEvent` | |
| `update_event` | write | `events.updateEvent` | Can move across days. |
| `delete_event` | destructive | `events.deleteEvent` | Unlinks expenses. |
| `create_task` | write | `tasks.addTask` | |
| `update_task` | write | `tasks.updateTask` | |
| `delete_task` | destructive | `tasks.deleteTask` | |
| `add_expense` | write | `extras.addExtra` | |
| `update_expense` | write | `extras.updateExtra` | |
| `remove_expense` | destructive | `extras.removeExtra` | |
| `set_exchange_rate` | write | `extras.setExchangeRate` | Changes every COP-derived number for all members. |

Not reachable by the agent: trip info, day spans, trip spans, travelers, task options, days themselves.

## Test coverage summary

| Suite | Covers |
|---|---|
| `src/server/domain/domain.test.ts` | server events, tasks, extras, read serializers |
| `src/utils/currency.test.ts` | conversions and split math |
| `src/utils/tripDays.test.ts` | date parsing, day generation, trip date formatting |

Untested: all API routes, `trip-store.ts` concurrency, `lib/validate.ts`, agent loop and tool executor, every client hook, all components.
