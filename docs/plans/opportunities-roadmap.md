# Opportunities roadmap

Status: wave 1 in progress · Base: `main` (cf2768e) · Date: 2026-10-13

## Context

`audit/OPPORTUNITIES.md` listed 29 feature ideas at `9049c34` (2026-09-28). Since then 136 commits landed: remediation phases 0 to 6, the relational cut-over (per-item tables, op registry, Broadcast), the UX wave, PWA/mobile, the map, Drive documents, idea videos and reel insights. This document re-validates every item against `main`, adds the bugs and new opportunities found along the way, and orders the work in waves.

Priority agreed with the user: **balanced**. Wave 1 fixes bugs and ships cheap wins that help both the owner's own trip and new groups. Then features for during the trip, then multi-user. Focus areas: during the trip, money, smarter assistant, collaboration.

The owner's trip runs 2026-11-26 → 2026-12-04 (confirmed), so anything meant for the trip must be deployed by about **2026-11-20**.

## 1. Validation of the original list

Legend: ✅ done · 🟡 partial · ⬜ not started. "Now" is the revised effort given today's architecture (ops registry, `*Rows.ts` validators, repos, `get_trip`, `applyRow`).

### Multi-user

| ID | Feature | Status | Evidence | What is left | Now |
|---|---|---|---|---|---|
| R1 | Server-assigned roles | 🟡 | Server assigns `owner`/`member` (`api/rooms/route.ts:40`, `members/route.ts:54`); `runOp` checks `op.minRole` (`ops/index.ts:33`) | Only two roles (`002_trips.sql:9`, `006:20`, `auth.ts:27`). Add `viewer`, reject ops for viewers, gate the non-op idea routes (`upload-url`, `video`, `idea-plan`, `places`), read-only UI, role change and ownership transfer | M |
| R2 | Invitation links with expiry | ⬜ | Join is by code only (`RoomGate.tsx:49`); codes are now 10 chars from `crypto.getRandomValues` (`room-code.ts`) | `room_invites` table + `accept_invite` SQL wrapping `join_room`; owner endpoint to create/revoke | M |
| R3 | Remove member | ⬜ | Only self-leave (`members/route.ts:37`) | `leave_room(p_code, p_user)` already handles any user: add `DELETE /members/[userId]` (owner) + button in `TravelersCard.tsx`. Without R2 the removed user can rejoin with the code | S |
| R4 | Delete / archive trip in UI | ⬜ | Owner-only `DELETE /api/rooms/[code]` exists, not wired (`GUIDELINES.md:107`); clients already react to `roomDeleted` (`useRoom.ts:108`) | "Eliminar para todos" in the owner menu; archive needs `rooms.archived_at` + `/list` filter | S |
| R5 | Per-user settings | ⬜ | `--app-zoom` global (`globals.css:104`), USD/COP fixed, view mode in localStorage | `user_settings` table + `/api/me/settings` + `useSettings`. Low value until i18n or multi-currency exist | S |
| R6 | Account deletion / export | ⬜ | PDF export exists (`App.tsx:199`) | Export: `getTrip(code)` as JSON (tiny). Delete: `leave_room` per membership, then `auth.admin.deleteUser` | M |

### Collaboration

| ID | Feature | Status | Evidence | What is left | Now |
|---|---|---|---|---|---|
| C1 | Presence | ⬜ | `useTripChannel.ts:33` has no presence; `realtime.messages` policy covers broadcast only (`010:171`) | Migration with presence select/insert policies, `track()` after subscribe, avatars in `AppHeader` | S |
| C2 | Activity log + undo | 🟡 | `trip_changes` by trigger (`008`, `010`), `GET /changes` (`server/activity.ts`), `ActivityDialog.tsx` | Per-change undo (relational-broadcast step 6.2): `change.revert` op from `before`/`after`, version-guarded. Agent `get_recent_changes`. Retention not scheduled | M |
| C3 | Comments | ⬜ | Nothing | `trip_comments` table (FKs to event/task, cascade), ops `comment.create/delete`, hook + `applyRow` | M |
| C4 | Votes on task options | ⬜ | `TaskOption` has no votes; `task.chooseOption` open to any member and deletes the task (`ops/tasks.ts:65-80`) | `trip_task_option_votes (room_code, option_id, user_id)` with an insert/delete op, so votes never 409. Owner-only choose needs R1 | S |
| C5 | Conflict indicator | ✅ | `useTripOps.ts:21` notice on 409, shown by `SyncNotice` | Optional "Reaplicar" button | — |

### Planning

| ID | Feature | Status | Evidence | What is left | Now |
|---|---|---|---|---|---|
| P1 | Templates + generic categories | 🟡 | Generic categories + `DEFAULT_EVENT_CAT` done (`categories.ts`) | Templates seeded on create. Superseded in practice by "duplicate a trip" (N8) and the assistant's batch create (A1) | S |
| P2 | Multi-currency | ⬜ | `"USD" \| "COP"` in types, DB checks (`008:117,161`), ~27 COP references in budget rows | Rates column, `trip.setRates` op, generalized `extraUnitUSD`, display currency. Bigger than estimated | L |
| P3 | Settlement (who owes whom) | ⬜ | No `paidBy`/`participants` | Nullable columns on `trip_expenses` + pure `utils/settlement.ts` + budget section + agent read tool | M |
| P4 | Attachments | 🟡 | Drive documents linked to events and expenses (`trip_documents`, `document.*` ops) | Real uploads only if Drive proves insufficient (bucket pattern from `022`) | — |
| P5 | Maps | ✅ (bug) | `EventPlace` lat/lng, `trip_event_places`, `TripMap`, `ItineraryMap`, offline tiles | Works only for Florida: see B1 | S |
| P6 | ICS export | ⬜ | Only PDF | Pure `utils/tripIcs.ts` + download button (S); subscribable signed feed (M) | S |
| P7 | Read-only share link | ⬜ | Joining by code always grants `member` | Viewer role (R1) delivered through invites (R2) | M |

### Assistant

| ID | Feature | Status | Evidence | What is left | Now |
|---|---|---|---|---|---|
| A1 | Itinerary from a brief | 🟡 | Prompt asks for all writes in one turn; one `confirm` holds them (`loop.ts`) | Batch `create_events` tool to save iterations (15-step cap) | S |
| A2 | Task options for the agent | ⬜ | `read.ts` returns tasks without options; no tool for `task.chooseOption` | `get_task_options` + `choose_task_option` | S |
| A3 | Packing list | ✅ | `empacar` task category (`taskCategories.ts:18`), mentioned in `create_task` | — | — |
| A4 | Per-user quota | ✅ | `007_agent_usage.sql`, `usage.ts` (300k tokens/day), 429 in route | Checked only before a run; one run can overshoot | — |
| A5 | Confirmation for writes | ✅ | Every write/delete pauses (`loop.ts`, `actions.ts`, `pending.ts`, `AgentConfirmCard`) | Resume token is reusable for 15 min; single-use nonce before members get the agent | S |
| A6 | Agent sees everything | 🟡 | 15 tools reach 11 of ~39 ops | Travelers by name, spans, task options, trip header, idea status, documents, places | M |

### Platform

| ID | Feature | Status | Evidence | What is left | Now |
|---|---|---|---|---|---|
| X1 | Onboarding | 🟡 | Landing + `EntryGate`; empty states in RoomGate, Ideas, Tasks | First-run guide inside a new trip | S |
| X2 | i18n | ⬜ | `lang="es"`; separate plan (next-intl) not started | Much more copy than at audit time | L |
| X3 | Mobile / PWA | ✅ mostly | Manifest + share target, `sw.js`, agenda view, bottom sheets, offline snapshot and tiles | Offline is read-only (`OfflineBanner`; `opQueue.ts:31` retries only 503): persist and replay the op queue | M |
| X4 | Analytics / errors | ⬜ | Only `console.error` (`http.ts:41`) | `@vercel/analytics`, error tracker, `app/global-error.tsx` | S |
| X5 | Usage limits | 🟡 | Per-trip limits (`limits.ts`), agent and video quotas | Trips-per-user cap in `POST /api/rooms`; tiers later | S |

**Summary:** 6 done (C5, P5, A3, A4, A5, X3 mostly), 10 partial, 13 not started. Premises that no longer hold: the `room-${code}` / `postgres_changes` channel (now private Broadcast), the full-payload 409 drop (now per-row versions), embedding new data in `RoomPayload` JSON (now a table or column per item type), `room_events` (exists as `trip_changes`), and the self-assigned roles (fixed).

## 2. Bugs found during validation

| ID | Bug | Evidence | Fix | Effort |
|---|---|---|---|---|
| B1 ✅ | The map works only for Florida/Bahamas | `TRIP_REGION` fixed bbox (`tripGeo.ts:13`); `ItineraryMap.tsx:68` filters every pin through `inTripRegion`; initial bounds `TripMap.tsx:63`; offline region `tripGeo.ts:131`; copy "Mapa de Orlando, Miami y el crucero" (`ItineraryMap.tsx:209`) | Derive the region from the trip's located stops, excluding far outliers (home airport) | S |
| B2 ✅ | "Mis viajes" shows no destination for trips created after the cut-over, a stale one for older trips | `list/route.ts:42` selects `payload->trip`, but `rooms.payload` is the frozen backup | Select `destination, start_date, end_date` columns | S |
| B3 | Assistant prompt describes removed behavior | `prompt.ts:25` "a video listing several spots becomes one idea per spot (parentId)"; PR #19 made spots ideas only when saved | Fix the sentence together with the other prompt edits (one cache miss) | S |
| B4 ✅ | Activity history loses names of ex-members | `activity.ts:67-72` looks names up in `rooms.members` | Resolve missing authors from their account (`auth.admin.getUserById`) | S |
| B5 | Dead ends | Idea status `"planned"` never set (`types/index.ts:121`); `addDaySpan` never called (`useItinerary.ts:174`) | Set `planned` when an activity is created from an idea (reel options plan); wire or drop day-span creation | S |

Other cruise-aware code (`CRUISE_PLACE` in `utils/ideas.ts`, aliases in `utils/places.ts`, examples in the geocoder and idea-plan prompts) only triggers on cruise text and is harmless for other trips.

## 3. New opportunities

| ID | Feature | User value | Hook point | Effort |
|---|---|---|---|---|
| N1 | Map for any destination | Every non-Florida trip gets a working map | B1 | S |
| N2 | Idea → activity from free gaps | Ideas turn into plan without retyping | **Covered by the reel options plan, phase 1** (`SlotCreateModal` + optional events, migration 023). Add: mark the source idea `planned` | — |
| N3 | Task due dates and assignee | "Who books the shuttle, by when" | Nullable `trip_tasks.due_date`, `assignee`; "Mis pendientes" filter; `insightTask` can set the date | M |
| N4 | Reminders | Deadlines reach people outside the app | Web Push (`push_subscriptions`, VAPID, Vercel Cron, `sw.js`) | L |
| N5 | Weather on Inicio | Plan the day around rain | `TodayCard.tsx`, `EventPlace.lat/lng`, Open-Meteo (no key), cached route | S-M |
| N6 | Plan check | Catch overlaps, impossible hops, nights without lodging, unbooked items | Pure `utils/planChecks.ts` (`distanceKm`), Home panel, agent `get_plan_issues` | M |
| N7 | Trip recap | Something to share after the trip | `HomeView.tsx` post phase, new `ReportKind` | M |
| N8 | Duplicate a trip | Reuse a past plan; replaces templates | SQL `clone_trip(src, dst, dayOffset)` + `POST /api/rooms {fromCode}` | M |
| N9 | Expense categories + chart | See where the money goes | Nullable `trip_expenses.cat`, guessed from linked event/document | S-M |
| N10 | Booking status per activity | "Reservar" tasks linked to the activity they book | Nullable `trip_tasks.event_id`; checklist in `ActivityDetail`; ⚠️ on unbooked blocks | S-M |
| N11 | "Mientras no estabas" | Catch up on changes without opening the history | `GET /changes?since=` + `last_active_at`, card on Home | S |
| N12 | Agent: trip guide | The assistant knows where advice was placed, votes, deadlines | `get_trip_guide` from `placedInsights` / `tripGuideText` | S |
| N13 | Agent: places | "What is near the hotel?", reorder a day by route | `get_places` from `trip_event_places` + distances | S |
| N14 | Paste a booking confirmation | Flights and hotels without typing | Agent extracts and proposes `create_event` / `add_expense` / `document.create` through the approval flow | M |

Also in flight: the remote MCP server (`feature/mcp-connector`, not merged; dashboard setup and claude.ai test pending) and the reel-insights manual follow-ups (real-reel eval, preview check, `VIDEO_MAX_SECONDS=90`).

## 4. Waves

Dropped or parked: **P1 templates** (duplicate a trip and the assistant's batch create cover it), **P4 uploads** (Drive links are enough until proven otherwise), **R5 settings** (nothing to configure until i18n or multi-currency), **N4 push** (ICS alarms give most of the value first; see §5.5).

### Wave 1 — Fixes and quick wins (target 2026-10-20)

PR A `fix/wave1-fixes` (1.1, 1.2, 1.3, 1.5) and PR B `feature/agent-tools` (1.4).

| # | Item | Effort |
|---|---|---|
| 1.1 ✅ | B2 "Mis viajes" destination from the `rooms` columns | S |
| 1.2 ✅ | B1/N1 map region derived from the trip's stops (§5.1) | S |
| 1.3 ✅ | B4 activity names for ex-members | S |
| 1.4 | Assistant batch 1 (§5.2): B3 prompt fix, A2 task options, A6 travelers/spans/header in read views, N12 trip guide, N13 places, A1 `create_events`, plus write tools for existing ops (`choose_task_option`, `add_traveler`, `remove_traveler`, `update_trip`) | M |
| 1.5 ✅ | X4 Vercel Web Analytics + errors stored in `app_errors` (migration 024; browser, server and error boundaries), so problems during the trip are visible | S |

### Wave 2 — Before and during the trip (target 2026-11-20, in priority order; cut from the bottom)

| # | Item | Depends on | Effort |
|---|---|---|---|
| 2.1 | Reel options plan, phase 1 (already designed; migration 023; covers N2). Add: an activity created from a saved idea sets that idea's status to `planned` (B5) | — | M |
| 2.2 | N3 task due date + assignee, N10 task linked to an activity (migration 025, §5.4) | — | M |
| 2.3 | P6 ICS download: activities + task deadlines with alarms (§5.5) | 2.2 | S |
| 2.4 | P3 who paid / who owes whom (migration 026, §5.3). Paid-by must exist during the trip; settling happens after | — | M |
| 2.5 | N6 plan check: overlaps, impossible hops, unbooked items, unconfirmed optional events | 2.1, 2.2 | M |
| 2.6 | X3 offline editing: persist and replay the op queue (the cruise has little or no internet) | — | M |
| 2.7 | N5 weather on Inicio and day headers (forecast exists only 16 days out) | — | S-M |
| 2.8 | N11 "Mientras no estabas" card on Inicio | — | S |

### Wave 3 — After the trip and assistant batch 2 (December)

| # | Item | Effort |
|---|---|---|
| 3.1 | N7 trip recap (stats, route map, final cost per person, top ideas) as a Home section and a new `ReportKind` | M |
| 3.2 | N9 expense categories + chart (nullable `trip_expenses.cat`, guessed from linked activity or document) | S-M |
| 3.3 | Assistant batch 2: `get_settlement`, `get_plan_issues`, `get_recent_changes`, due date/assignee in task tools, N14 paste a booking confirmation | M |
| 3.4 | C2 per-change undo (`change.revert` op, version-guarded) | M |
| 3.5 | N8 duplicate a trip (`clone_trip` SQL with day offset) | M |

### Wave 4 — Open to other groups (January)

| # | Item | Depends on | Effort |
|---|---|---|---|
| 4.1 | R1 `viewer` role: constraint + `join_room`, `runOp` rejects viewers, gate the non-op idea routes, read-only UI, ownership transfer | — | M |
| 4.2 | R2 invite links with expiry and revoke; P7 = a viewer invite | 4.1 | M |
| 4.3 | R3 remove member; R4 "Eliminar para todos" + archive | 4.1 | S |
| 4.4 | C4 votes on task options (`trip_task_option_votes` table); choosing becomes owner-only | 4.1 | S-M |
| 4.5 | C1 presence avatars in the header | — | S |
| 4.6 | A5 single-use resume token, then open the assistant to members (per-user quota already exists) | — | S |
| 4.7 | X5 trips-per-user cap; X1 first-run guide in a new trip; R6 JSON export + account deletion | — | M |

### Backlog

C3 comments, N4 Web Push, P2 multi-currency, X2 i18n (own plan), R5 settings, P6 subscribable calendar feed, participants subset for settlement. Separate tracks already in flight: MCP connector (`feature/mcp-connector`), reel insights follow-ups, reel options phases 2 to 4.

## 5. Designs for the key items

### 5.1 Map region from the trip's stops (B1)

- `src/utils/tripGeo.ts`: replace `TRIP_REGION` / `inTripRegion` with `tripRegion(stops: MapStop[]): BBox | null` and `inBBox(b, p)`.
  - Single-linkage clusters: two stops join when they are within 1,000 km. Keep the cluster with the most visits, so a home airport used twice still loses to the trip.
  - Pad the bbox by 10% and to a minimum span (~0.3°) so one-city trips get overview zooms.
  - `null` when nothing is located.
- `ItineraryMap.tsx:68`: compute `region = tripRegion(mapStops(...))`, then filter stops with `inBBox(region)`; pass `region` to `TripMap`.
- `TripMap.tsx:63`: initial bounds = `region` (world view when `null`). At `:79`, center on the user's location only when it falls inside `region`.
- `offlineTiles(points, region)`: region zooms over `region`. Drop the top region zoom while the tile count exceeds a cap (~3,000), so a continent-wide trip does not download too much.
- `ItineraryMap.tsx:209`: copy becomes "Mapa del viaje guardado para usar sin internet".
- Tests (`tripGeo.test.ts`): Florida fixture keeps Orlando/Miami/Nassau/CocoCay and drops Cali; a Japan trip keeps Tokyo/Kyoto/Osaka; one stop; none.

### 5.2 Assistant batch 1

- Keep `tools.ts` (294 lines) under 400. New modules follow the `ideaTools.ts` pattern (`TOOLS`, `TOOL_LABELS`, `isXTool`, `runXTool`):
  - `src/server/agent/tripTools.ts`: travelers, header, task options, batch create;
  - `src/server/agent/guideTools.ts`: guide and places.
- Read tools (no approval; `read` in `TOOL_KIND`):
  - `get_task_options`: options with `optionGroupUSD`;
  - `get_trip_guide`: from `placedInsights` / `tripGuideText` in `utils/insights.ts`;
  - `get_places`: located places per day, plus the distance between consecutive stops via `distanceKm`;
  - extend `tripOverview` in `domain/read.ts` with traveler names, trip spans and the trip header.
- Write tools map to existing ops:
  - `create_events` → N × `event.create`;
  - `choose_task_option` → `task.chooseOption`;
  - `add_traveler` / `remove_traveler` → `traveler.add` / `traveler.remove`;
  - `update_trip` → `trip.update`.
- In `TOOL_KIND`, `remove_traveler` and `choose_task_option` are `delete` (choosing deletes the task). Spanish summaries go in `describeAction` (`actions.ts`), e.g. "Crear 6 actividades: …".
- `create_events` runs its ops in order. If one fails, the result lists what was created plus the error, so the model can retry the rest.
- No `strict: true` (GUIDELINES §1, AI assistant).
- `prompt.ts`: fix line 25 only (spots become ideas when the group saves them). New tools carry their guidance in their descriptions. Ship all tool and prompt changes in one deploy: tools and the system prompt form the cached prefix, so this costs one cache miss.
- Tests: `actions.test.ts` (kinds + summaries), `tools.test.ts` (tool → ops mapping, batch partial failure), new module tests like `ideaTools.test.ts`.

### 5.3 Who paid / who owes whom (P3)

- Migration 026: `trip_expenses.paid_by text null` with a length check. Recreate `get_trip` with it; add to `trip_payload` if it must survive a rollback.
- `Extra.paidBy?: string` holds a person id: a member's user id (`rooms.members`) or a traveler id (`trip_travelers`). These are the same people the per-person math counts.
  - Validator in `domain/expenseRows.ts`; `rowToExtra` in `utils/tripRows.ts`; `useBudget` optimistic update + `applyRow`.
- Everyone shares every expense, as the per-person math assumes today. A participants subset would change existing totals, so it stays in the backlog.
- Pure `src/utils/settlement.ts`:
  - `balances(extras, people, rate)`: for each expense with `paidBy`, credit the payer `extraGroupUSD(...)` and debit each person `extraPerPersonUSD(...)`.
  - Expenses without a payer go to an "unassigned" total.
  - `settle(balances)`: greedy, largest debtor pays largest creditor, rounded to cents → `[{ from, to, usd }]`.
  - Unknown ids (someone left) render as "Ex miembro".
- UI: a "¿Quién pagó?" select in `GlobalExtraRow` / `DayExtraRow` (dirty + ✓/✕), and a new `budget/SettlementCard.tsx` ("Cuentas claras") with balances and transfers in USD and COP.
- Tests: 1, 2 and 3+ people; group and perPerson; USD and COP; unassigned; a payer who left.

### 5.4 Task due date, assignee and linked activity (N3, N10)

- Migration 025 on `trip_tasks`, all nullable:
  - `due_date date`;
  - `assignee text` (person id, as in §5.3);
  - `event_id text`, with FK `(room_code, event_id) → trip_events on delete set null (event_id)`, mirroring `linked_event_id` (`008:126`).
  - Recreate `get_trip`.
- Field checklist (GUIDELINES §2.6): `database.ts`, `taskRows.ts`, `tripRows.ts`, `Task` type, `useTasks`.
- `TasksView.tsx` is at 338 lines: extract the task editor into `tasks/TaskEditor.tsx` before adding the date, assignee and activity pickers.
- Views:
  - "Mis pendientes" filter (assignee = me).
  - Overdue and due-soon badges in Home "Por decidir".
  - A "Por reservar" checklist in `ActivityDetail`, and ⚠️ on calendar blocks with open booking tasks.
  - `insightTask` (`utils/insights.ts`) sets `dueDate` when the advice has a deadline.

### 5.5 ICS export first, push later (P6, N4)

- Pure `src/utils/tripIcs.ts`:
  - Activities become VEVENTs. Date = `trip.startDate` + day index; decimal hours, where values ≥ 24 roll to the next day. Times are floating, so they show at local time on the trip.
  - Open tasks with `dueDate` become all-day VEVENTs with a `VALARM` the day before.
- A download item next to the PDF exports in the header menu.
- Unit tests for the hour rollover and text escaping.
- This puts each member's plan and deadlines on their phone calendar, with native reminders, without push infrastructure.
- Web Push stays in the backlog. It needs VAPID keys, a `push_subscriptions` table and a cron. On iOS it works only from an installed PWA (16.4+), and Vercel Cron on Hobby runs at most once a day.

### 5.6 Other wave 2 notes

- **Weather (N5):**
  - Server route `GET /api/rooms/[code]/weather` (`requireMember`). For each trip day it takes the first located stop from `trip_event_places` and calls the Open-Meteo daily forecast (no key).
  - Cache with `fetch(..., { next: { revalidate: 3600 } })`.
  - Server-side, so no CSP change.
- **Offline editing (X3):** start with a one-step spike.
  - Persist pending `OpQueue` ops per room on the device and replay them on reconnect.
  - A replayed create that already succeeded (same id) counts as success, not as a duplicate.
  - The banner says "N cambios pendientes".
- **Plan check (N6):** pure `src/utils/planChecks.ts` with tests, shown as a "Revisar plan" panel on Home. It flags:
  - same-day overlaps outside spans;
  - consecutive located activities farther apart than the gap allows (`distanceKm` at ~40 km/h);
  - booking tasks still open within 7 days;
  - optional events not confirmed.
- **"Mientras no estabas" (N11):** `GET /changes?since=` with the previous `last_active_at`, which must be read before opening the trip bumps it. Rendered with `activitySentence`.

## 6. Execution and verification

- One branch per item group (`feature/<name>`) from `main`, in a worktree when another branch is checked out.
- Migrations 023 (reel options), 024 (`app_errors`, wave 1), 025 and 026, in that order. Apply each to the staging Supabase project first, then production, always before deploying the code that reads it.
- Every item: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and GUIDELINES §5 Definition of Done (open a trip created before the change, reload, a second account sees the change live).
- Wave 1 checks:
  - **B2:** a trip created after the cut-over shows its destination in "Mis viajes".
  - **B1:** a non-Florida test trip shows pins and stores offline tiles; the Florida trip still hides the home airport.
  - **Assistant:** with a real key on a Preview, ask "¿quién viene?", "¿qué hay cerca del hotel?", "arma el día 3", and choose a task option; approve and reject.
- Wave 2 checks:
  - **Money:** 1, 2 and 3+ people; USD and COP; group and perPerson.
  - **ICS:** import into Google Calendar and Apple Calendar; times past midnight land on the next day.
  - **Offline:** airplane mode, edit, reconnect, no duplicates.
- Mark items done in this file as they ship.
