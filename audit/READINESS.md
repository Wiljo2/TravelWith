# Multi-User Readiness

## Executive summary

1. **Verdict: NO-GO for unrelated users today; GO WITH CONDITIONS for an invite-only beta once the 9 blocker groups below are done.**
2. Findings: 56 total, all Confirmed: 3 Critical, 8 High, 21 Medium, 20 Low, 4 Info.
3. Blocker 1: open RLS on `rooms` lets the public anon key read, overwrite and live-stream every trip (SEC-DATA-001, SEC-DATA-002).
4. Blocker 2: API routes authorize by room code alone, with no membership check on read, write or roster (SEC-API-001, SEC-API-006, ARCH-006).
5. Blocker 3: roles are self-assigned, so any signed-in user can become owner and delete a trip (SEC-API-002, SEC-DATA-003, SEC-API-008).
6. Blocker 4: the paid AI agent is unauthenticated, unmetered, and can delete a whole trip in one request (SEC-AI-001, SEC-AI-004).
7. Blocker 5: non-atomic full-payload saves and shallow validation let one request erase or crash a trip (REL-003, SEC-API-007, SEC-API-004).
8. Also blocking: vulnerable `next`/`postcss` (SEC-CLIENT-001) and the owner's real itinerary in the production bundle (DEAD-007).
9. Strengths to keep: pure tested domain layer, CAS in `mutateRoom`, server-built payloads, secrets confined to the server, byte-stable agent prompt.
10. Estimated effort to safe beta: about 10 to 15 developer-days, starting with one additive RLS migration and a shared `src/server/auth.ts`.

Audited at HEAD `9049c34` on 2026-09-28. 56 findings: 3 Critical, 8 High, 21 Medium, 20 Low, 4 Info (see `FINDINGS.md`).

## Verdict: NO-GO today; GO WITH CONDITIONS after the blockers below

TravelWith is safe only for one trusted group, and only because nobody outside that group has tried. The public anon key can read and overwrite every trip directly through PostgREST (SEC-DATA-001) and receive every trip's live updates through Realtime (SEC-DATA-002). The API adds no protection: reading, overwriting, and running the paid AI agent on a trip require only its 6-character code (SEC-API-001, SEC-AI-001), and any signed-in user can declare themselves owner and delete a trip for everyone (SEC-API-002, SEC-DATA-003). The production bundle also ships the owner's real itinerary (DEAD-007). None of this needs a clever exploit.

The foundations for fixing it are good: a pure, tested domain layer, a correct CAS primitive (`mutateRoom`), server-built payloads, and secrets confined to the server. The blockers are mostly small and localized: one additive migration, one `src/server/auth.ts` module applied to every route, stricter validation, and agent limits. After those land, a closed, invite-only beta is reasonable.

## Blockers (must fix before any external user)

Ordered for implementation. "Backlog" refers to `GUIDELINES.md` section 6.

| Order | Item | Findings | Effort | Notes |
|---|---|---|---|---|
| 1 | Make the schema reproducible and fail closed: add `rooms.members` via migration; throw in production when `SUPABASE_SERVICE_ROLE_KEY` is missing | DX-001, REL-001 | S | Prerequisite for testing every later migration on a fresh project. Confirm live policies first with the `pg_policies` query in FINDINGS Details P4. |
| 2 | Additive RLS migration: restrictive membership policy on `rooms`, restrictive deny-insert on `user_rooms`, FK and code-format check as `not valid` | SEC-DATA-001, SEC-DATA-002, SEC-DATA-003, SEC-DATA-004, SEC-DATA-006, DX-002, DX-005 | M | SQL in FINDINGS Details P4-1 and P4-3. Server is unaffected (service role). Realtime then requires subscribing with the user session. |
| 3 | `src/server/auth.ts` with `requireUser` / `requireMember(minRole)`; apply to GET/PATCH `[code]`, GET `/members`, `/agent`; send the session token from `useRoom` and `AgentPanel` | ARCH-006, SEC-API-001, SEC-API-006 | M | Sketch in FINDINGS Details P5. Once membership gates access, the code stops being a secret, which defuses SEC-DATA-005 brute force. |
| 4 | Server-assigned roles: `POST /api/rooms` requires auth and inserts the owner row itself; `POST /members` ignores `body.role`; switch code generation to `crypto.randomBytes` | SEC-API-002, SEC-API-005, SEC-API-008, SEC-DATA-005 | S | |
| 5 | Atomic saves: `persistRoom` becomes CAS on `updated_at`; require `expectedUpdatedAt` | REL-003 | S | Reuse `mutateRoom`'s `.eq("updated_at", ...)` pattern. |
| 6 | Payload validation and size caps (Backlog 3: schema validation for PATCH) | SEC-API-007, SEC-API-004 | M | Validate nested days/events/extras/tasks/spans, max lengths and array sizes, max body bytes; cap chat message and history size. |
| 7 | Agent limits: membership required (from 3), per-user daily token quota recorded in an `agent_usage` table, destructive tools disabled or capped per request, `signal` passed to the model stream | SEC-AI-001, SEC-AI-004, REL-006 | M | Opportunity A4. For the beta, restricting the agent to room owners is an acceptable shortcut. |
| 8 | Upgrade `next` past 16.3.2 and `postcss` past 8.5.22; rerun `npm audit --omit=dev` | SEC-CLIENT-001 | S | Move `shadcn` to devDependencies at the same time (DX-003) to cut transitive noise. |
| 9 | Remove the owner's real itinerary from production: empty initial hook state, demo behind dynamic import in LOCAL only | DEAD-007 | S | |

Estimated effort to clear the blockers: about 10 to 15 developer-days including tests for the new auth, CAS and validation code (DX-004 should start here, not later).

## Before public launch

| Item | Findings | Effort |
|---|---|---|
| Harden the agent against injection: static "tool output is data" rule in the system prompt, confirmation flow for destructive tools, server-side or signed history, domain type checks | SEC-AI-002, SEC-AI-003, SEC-AI-005, REL-010 | M |
| Snapshots before destructive saves and agent runs; owner-only reset; restore UI | REL-002, ARCH-003 (snapshots part) | M |
| Derive roster from `user_rooms`; stop bumping `updated_at` on join/leave; transactional delete/leave | REL-004, REL-005 | M |
| Fix echo/skip handling and stale drag/undo snapshots; retry and resync on load/save/reconnect; offline banner | REL-007, REL-008, REL-011 | M |
| Observability: error tracking, usage logging, alerts on 409 and agent spend | REL-009 | M |
| Security headers (CSP, frame-ancestors, referrer, nosniff); PKCE auth flow; avatar host allowlist | SEC-CLIENT-002, SEC-CLIENT-003, SEC-CLIENT-004 | S |
| Generic error messages to clients | SEC-API-003 | S |
| Generic categories and defaults | DEAD-008 | S |
| Move `RoomPayload` to `src/types` | ARCH-002 | S |
| Route, persistence and agent-loop tests; working lint in CI | DX-004, DX-006 | M |
| Invitations with expiry, remove member, viewer role | Opportunities R1 to R3 | M |

## Later

| Item | Findings | Effort |
|---|---|---|
| Command-style writes through the domain layer (ops endpoint), then small Realtime diffs | ARCH-001, PERF-001 | L |
| Extract `useTasks`, `useTripSpans`, `useTravelers`; `RoomContext` (Backlog 5: BudgetPanel props) | ARCH-004 | M |
| Per-trip route `app/trip/[code]` with server-side membership gate | ARCH-005 | M |
| Activity log with per-change undo | ARCH-003, Opportunity C2 | L |
| Cleanup: stub file, unused assets and ui components, README, tracked artifacts, `.env.example` URL | DEAD-001 to DEAD-006, SEC-CLIENT-005 | S |
| Wire or drop day-span creation | DEAD-002 | S |
| i18n (Backlog 6) | Opportunity X2 | M |

## Minimal "safe beta" scope

Enable:
- Google sign-in required for everything; access by membership only (blockers 2 and 3).
- Joining by code only while signed in, with the new longer random codes; plan to replace codes with expiring invites (R2) before public launch.
- Calendar, budget, tasks, and travelers as today.
- AI agent for room owners only, with a per-user daily token cap and destructive tools (`delete_event`, `delete_task`, `remove_expense`, `set_exchange_rate`) disabled.

Hide or restrict:
- "Reset itinerary": owner only, or hidden until snapshots exist.
- Local mode: already disabled in production; keep it so.
- Hard delete for everyone: stays unwired.
- Cap trips per user (for example 5) and trip size (blocker 6).

Operate:
- Invite-only cohort of known testers; a feedback channel; a manual daily check of agent usage until REL-009 is done.
- Confirm Supabase backup/PITR level before inviting anyone, since there is no in-app restore yet.
