# Feature Opportunities

> Re-validated on 2026-10-13 against `main` (cf2768e): status per item, bugs, new opportunities and the wave plan are in `docs/plans/opportunities-roadmap.md`.

Audited at HEAD `9049c34`. Each item names where it plugs into the existing layers. Rules applied: new persisted fields are optional with read-time defaults, SQL is additive, server writes go through `src/server/domain/*` + `mutateRoom`, and the agent system prompt stays byte-stable (new data flows through tools).

"Depends on" lists findings that must be fixed first. Effort: S (under 1 day), M (1 to 3 days), L (more than 3 days).

## 1. Required for multi-user

| # | Feature | Problem | User value | How it plugs in | Effort | Depends on |
|---|---|---|---|---|---|---|
| R1 | Server-assigned roles (owner, editor, viewer) | Roles are self-declared (SEC-API-002) and only owner/member exist | Owners control who can edit or delete | `user_rooms.role` check constraint extended via new migration (`not valid` + validate); `POST /api/rooms` inserts owner row; `requireMember(req, code, minRole)` in `src/server/auth.ts`; UI reads role from `/api/rooms/list` | M | SEC-API-002, SEC-DATA-003, ARCH-006 |
| R2 | Invitation links with expiry | The room code is both identifier and permanent secret (SEC-DATA-005) | Share safely; revoke a leaked link | New table `room_invites (token text pk, room_code, role, expires_at, max_uses, created_by)`; `POST /api/rooms/[code]/invites`, `POST /api/invites/[token]/accept`; token from `crypto.randomBytes(24)` | M | R1 |
| R3 | Remove member / leave | Leave exists; owners cannot remove anyone | Kick a wrong invitee | `DELETE /api/rooms/[code]/members/[userId]` (owner only); roster derived from `user_rooms` (fixes REL-004) | S | R1, REL-004 |
| R4 | Delete and archive trip in UI | Hard delete exists but is unwired; no archive | Owners clean up; past trips stay readable | Optional `rooms.archived_at timestamptz` column; `/list` filters; owner-only action in `RoomGate` | S | R1 |
| R5 | Per-user settings | Zoom, currency display, language are global constants (`globals.css:102`, COP hardcoded) | Personal preferences across devices | New table `user_settings (user_id pk, prefs jsonb)`; `useSettings` hook; not in `RoomPayload` (per-user, not per-trip) | S | none |
| R6 | Account deletion and data export | No way for a user to leave the platform or get their data | Privacy compliance (GDPR-style requests) | `DELETE /api/me` removes `user_rooms` rows and roster entries (auth cascade exists, `002_trips.sql:7`); `GET /api/rooms/[code]/export` returns payload JSON | M | SEC-API-001 |

## 2. Collaboration

| # | Feature | Problem | User value | How it plugs in | Effort | Depends on |
|---|---|---|---|---|---|---|
| C1 | Presence ("who is here") | Members do not know who else is editing | Fewer accidental conflicts | Supabase Realtime Presence on the existing `room-${code}` channel in `useRoom`; avatars in `AppHeader` | S | SEC-DATA-002 (subscribe with session) |
| C2 | Activity log and per-change undo | No history, no attribution (ARCH-003, REL-002) | "Who deleted my dinner?" answered; restore | New table `room_events (id, room_code, user_id, op, args jsonb, created_at)` written by the command endpoint from ARCH-001; snapshots table for restore; agent tool `get_recent_changes` (read) | L | ARCH-001 |
| C3 | Comments on events and tasks | Discussion happens outside the app | Decisions stay attached to items | Optional `comments?: Comment[]` on `CalendarEvent` and `Task` (read default `[]`), or a separate table if volume grows; domain `comments.ts` | M | SEC-API-001 |
| C4 | Votes on task options | `chooseTaskOption` is a unilateral, irreversible choice (`App.tsx:102-122`) | Group decides; owner confirms | Optional `votes?: string[]` (user ids) on `TaskOption`; domain `tasks.voteOption`; agent tool `vote_option` | S | R1 |
| C5 | Conflict indicator instead of silent discard | 409 drops local edits (`useRoom.ts:54-64`) | Users see and resolve conflicts | Toast "Another member changed this; your edit was not saved" plus re-apply button; long term solved by ops (ARCH-001) | S | REL-003 |

## 3. Planning

| # | Feature | Problem | User value | How it plugs in | Effort | Depends on |
|---|---|---|---|---|---|---|
| P1 | Trip templates and generic categories | Cruise/Miami defaults (DEAD-008) | Works for any trip type | Add generic keys to `CATEGORIES`, `DEFAULT_EVENT_CAT` constant; optional `trip.template?` on `TripInfo`; `POST /api/rooms` seeds from template server-side | S | DEAD-008 |
| P2 | Multi-currency | `currency?: "USD" \| "COP"` only (`types/index.ts`) | International groups | Widen the union additively (`"EUR" \| "MXN" ...`), optional `rates?: Record<string, number>` on `RoomPayload` with `exchangeRate` kept as COP fallback; `extraUnitUSD` generalizes | M | none |
| P3 | Expense settlement ("who owes whom") | Budget tracks cost but not who paid | Settle up after the trip | Optional `paidBy?: string` (userId or mockPerson id) and `participants?: string[]` on `Extra`; pure `utils/settlement.ts` with tests; agent read tool `get_settlement` | M | none |
| P4 | Attachments and reservations | Confirmations live in notes as links | One place for tickets and bookings | Supabase Storage bucket with membership RLS; optional `attachments?: {path, name}[]` on events | M | SEC-DATA-001 (same RLS model) |
| P5 | Maps | Locations are free text | See the day's route | Optional `location?: {name, lat, lng}` on `CalendarEvent`; map view component | M | none |
| P6 | ICS / Google Calendar export | Plans are locked in the app | Itinerary on each member's phone | `GET /api/rooms/[code]/calendar.ics` built from `days` + `trip.startDate`; per-user secret feed URL | S | SEC-API-001 |
| P7 | Read-only share link | Sharing today grants full write | Show the plan to family safely | Viewer role (R1) via invite (R2), or signed read-only token route | S | R1, R2 |

## 4. AI agent

| # | Feature | Problem | User value | How it plugs in | Effort | Depends on |
|---|---|---|---|---|---|---|
| A1 | Itinerary generation from a brief | Empty trips start blank | Fast first draft | Existing write tools suffice; add a batch tool `create_events` (domain loop inside one `mutateRoom`) to cut iterations | S | SEC-AI-001, SEC-AI-004 |
| A2 | Budget optimizer | Users compare options manually | Cheaper plans | Read tools already expose budget; add `get_task_options` read tool (options are not visible to the agent today) | S | SEC-AI-001 |
| A3 | Packing list | Common trip chore | Less forgotten stuff | Tasks with a new `TASK_CATEGORIES` key `equipaje`; no schema change | S | none |
| A4 | Per-user agent quota | Uncapped cost (SEC-AI-001) | Predictable spend | Table `agent_usage (user_id, room_code, input_tokens, output_tokens, created_at)`; check before loop, write after `done` | S | SEC-AI-001 |
| A5 | Confirmation UX for destructive tools | One prompt can delete everything (SEC-AI-004) | Trust the assistant | Destructive tools return `pending_confirmation` with a diff; `AgentPanel` renders Confirm/Cancel; `POST /api/rooms/[code]/agent/confirm` applies via domain | M | SEC-AI-002, SEC-AI-004 |
| A6 | Agent visibility for spans, travelers, options | Tools miss trip spans, day spans, travelers, task options (FEATURES.md) | Agent can answer "who is coming" and edit decisions | New read tools + domain functions; static tool descriptions keep caching | M | none |

## 5. Platform

| # | Feature | Problem | User value | How it plugs in | Effort | Depends on |
|---|---|---|---|---|---|---|
| X1 | Onboarding | New users land on a code prompt with no context | Activation | Empty-state guide in `RoomGate`; template picker (P1) | S | P1 |
| X2 | i18n ES/EN | UI copy is Spanish only (GUIDELINES backlog 6) | Wider audience | Message catalogs, `useLocale`; agent already replies in the user's language (`prompt.ts`) | M | none |
| X3 | Mobile layout / PWA | Fixed 300px side panel, desktop grid (`App.tsx:284`) | Use during the trip | Responsive layout, day-at-a-time view, `app/manifest.ts`; offline queue ties to REL-008 | L | REL-008 |
| X4 | Analytics | No product or error signal (REL-009) | Know what users do and where it breaks | Vercel Analytics + error tracking; server usage tables (A4) | S | none |
| X5 | Usage limits and pricing tiers | Unbounded rooms, payloads, agent use | Sustainable costs | Limits table keyed by user; enforce in `POST /api/rooms`, PATCH size, agent quota | M | A4, SEC-API-004, SEC-API-005 |

## Suggested sequencing
1. R1, R2, R3 together with the P12 blockers (they share `src/server/auth.ts`).
2. A4, A5 before exposing the agent to non-owners.
3. P1, X1 for the first external users.
4. C2 after ARCH-001 (it needs the ops log); C1, C4, C5 are cheap wins in between.
