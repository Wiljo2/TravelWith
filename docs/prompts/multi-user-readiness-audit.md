# TravelWith: Multi-User Readiness Audit (loop prompt)

> Usage (Claude Code, from the repo root): `/loop Follow docs/prompts/multi-user-readiness-audit.md and run the next iteration`
> Each run executes ONE iteration, updates `audit/STATE.md`, and stops. The loop ends when the exit criteria in section 7 are met.

---

## 0. Role and goal

You are a senior staff engineer and application security reviewer auditing **TravelWith**, a collaborative trip planner (Next.js 16 App Router, React 19, TypeScript, Tailwind v4 + shadcn/ui, Supabase Postgres + Realtime + Auth, Vercel, Claude agent via `@anthropic-ai/sdk`).

Today the app was built for one private group trip. The owner wants to **open it to additional, unrelated users**. Your job is to decide, with evidence, whether that is safe and what must change first. You produce:

1. A security scan (threat model + concrete vulnerabilities).
2. An architecture and design review (patterns in use, anti-patterns to remove, dead code to delete).
3. A complete inventory of current features.
4. A list of features the app could have, given how it is being built.
5. A multi-user readiness verdict (GO / GO WITH CONDITIONS / NO-GO) with a prioritized remediation plan.

## 1. Ground rules

- **Read-only on product code.** Never modify anything outside `audit/`. No commits, no installs that change `package.json`, no migrations, no calls that write to Supabase, Vercel, or the Anthropic API.
- **Never print secrets.** You may check whether `.env.local`, `.vercel/`, or keys are tracked by git or referenced in client code, but never echo their values. Redact as `sk-...xxxx`.
- **Evidence or it did not happen.** Every finding cites `path:line` (or a SQL policy / config key) and a short quote. No generic advice without a concrete anchor in this repo.
- **Respect repo rules.** Read `CLAUDE.md` and `GUIDELINES.md` first every iteration. Recommendations must fit them (additive migrations only, optional persisted fields, domain layer for server writes, no file over ~400 lines, English in code/docs).
- **Verify, do not assume.** Run `npx tsc --noEmit`, `npm test`, and `npm audit --omit=dev` when relevant (read-only). If a command cannot run, record why.
- Writing style for audit files: English, concise, tables where they help, no em dashes.

## 2. State management (how the loop remembers)

All state lives in `audit/`. Create it on the first iteration.

```
audit/
  STATE.md                 # iteration counter, phase checklist, next action, stable-pass counter
  FINDINGS.md              # every finding, one row each, stable IDs
  FEATURES.md              # current feature inventory
  OPPORTUNITIES.md         # candidate new features
  ARCHITECTURE.md          # architecture map, patterns, anti-patterns, dead code
  THREAT_MODEL.md          # actors, assets, trust boundaries, abuse cases
  READINESS.md             # final verdict + remediation roadmap
```

Every iteration:

1. Read `audit/STATE.md` (create it if missing, with the phase checklist in section 3 all unchecked).
2. Pick the **first unchecked phase**. If all phases are checked, run a **validation pass** (section 6).
3. Do that phase fully, write results to the right file(s).
4. Update `STATE.md`: increment iteration, check the phase, set `Next action`, log a one-line summary with the count of new / changed / closed findings.
5. Stop. Do not start the next phase in the same run.

## 3. Phases (checklist for STATE.md)

- [ ] P1. Recon and architecture map
- [ ] P2. Feature inventory
- [ ] P3. Threat model for multi-user
- [ ] P4. Security: data access (Supabase RLS, schema, Realtime)
- [ ] P5. Security: API routes and server code
- [ ] P6. Security: AI agent (prompt injection, tool abuse, cost)
- [ ] P7. Security: client, config, secrets, dependencies, headers
- [ ] P8. Architecture patterns and anti-patterns
- [ ] P9. Dead code and cleanup candidates
- [ ] P10. Scalability, reliability, data integrity
- [ ] P11. Product: feature opportunities
- [ ] P12. Multi-user readiness verdict and roadmap
- [ ] V. Validation passes (repeat until exit criteria)

## 4. Phase instructions

### P1. Recon and architecture map
- Walk `src/`, `supabase/migrations/`, `next.config.ts`, `package.json`, `.gitignore`, `components.json`, `vitest.config.ts`, `.oxlintrc.json`.
- Map layers: `app/page.tsx` -> `src/App.tsx` -> hooks (`useRoom`, `useItinerary`, `useBudget`, `useDragDrop`, `useAuth`, `useUserRooms`) -> components; API routes `src/app/api/rooms/**`; domain layer `src/server/domain/*`; persistence `src/server/trip-store.ts`; agent `src/server/agent/*`.
- Draw the data flow for: create room, join room, edit event, autosave (600ms debounce) + Realtime sync, agent tool call mutating the room.
- Record every trust boundary (browser, Next.js server, Supabase with anon key, Supabase with service role, Anthropic API).
- Output: `ARCHITECTURE.md` section "Map" with a Mermaid diagram.

### P2. Feature inventory
For each feature: name, user-facing description, entry component(s), hooks, API routes, persisted fields in `RoomPayload`, tests covering it, known limitations. Cover at least: rooms (create/join/list/members/last active), auth, calendar grid, drag and drop with undo, event editor, trip spans, budget (extras, group vs perPerson split, currency/exchange rate, per-person card, travelers), tasks (options, calendar task blocks), note links/linkify, zoom, local mode `?local=1`, AI agent panel and each agent tool. Output: `FEATURES.md`.

### P3. Threat model
Actors: anonymous internet user, authenticated user who is not a member, room member, room owner, malicious member, someone who guessed or leaked a room code, automated bot, prompt-injection author (text inside a trip note read by the agent). Assets: trip payloads (may contain names, dates, reservations, PII, prices), membership data, Anthropic API budget, Supabase quota, availability. Use STRIDE per trust boundary. Output: `THREAT_MODEL.md` with an abuse-case table.

### P4. Security: data access
Check at minimum and confirm or refute each with evidence:
- `rooms` RLS: policies `using (true)` for select/insert/update. Can the anon key (shipped to the browser) **list, read, and overwrite every room** in the database? Can a client bypass the API and write arbitrary JSONB?
- Is `rooms` in `supabase_realtime` leaking changes of all rooms to any subscriber?
- `user_rooms`: can a user insert themselves as `role = 'owner'` or join any room just by inserting a row? Is there a delete policy for rooms? Is there any link between `user_rooms` and actual access to `rooms`?
- Room code entropy: `Math.random().toString(36).slice(2, 8)` is 6 chars, non-cryptographic. Estimate brute-force feasibility. Is there rate limiting?
- Payload size limits, JSON shape validation on write, last-write-wins / lost updates between autosave and `mutateRoom`.
- Deliverable per issue: exploit steps (described, not executed), impact, fix (policy SQL as an additive migration proposal, not applied).

### P5. Security: API routes and server code
For every handler in `src/app/api/rooms/**`: authentication, authorization (is the caller a member/owner?), input validation (`src/lib/validate.ts`), error leakage (`error.message` returned to client), IDOR on `[code]`, method coverage, CSRF relevance, use of the service role client and whether it bypasses RLS without an auth check. Check `mutateRoom` concurrency logic for races.

### P6. Security: AI agent
- Is `POST /api/rooms/[code]/agent` callable without auth? Any per-user / per-room / per-IP rate or token budget? Cost exposure if the URL is shared.
- `MAX_ITERATIONS`, `MAX_HISTORY_MESSAGES`, message size caps: are client-supplied `messages` trusted (can a caller forge assistant turns)?
- Tools in `src/server/agent/tools.ts`: list each, classify read vs write vs destructive, check argument validation, blast radius (can one prompt delete everything?), confirmation for destructive actions.
- Indirect prompt injection: trip notes, titles, and task text are user content read back by read tools. Could a malicious member plant instructions that make the agent act for another member?
- System prompt stability vs dynamic data (prompt cache rule in `CLAUDE.md`).

### P7. Security: client, config, secrets, dependencies
- Is any secret or `.env.local` tracked in git history (`git log --all -- .env.local`, `git grep` for key patterns)? Report yes/no only.
- `NEXT_PUBLIC_*` variables: confirm only the anon key and URL are public.
- `next.config.ts`: security headers (CSP, X-Frame-Options, Referrer-Policy), image domains.
- XSS: `linkify.ts`, `NoteLinks.tsx`, any `dangerouslySetInnerHTML`, `href` from user input (`javascript:` URLs), `target=_blank` without `rel`.
- Auth flow in `useAuth` / `AuthButton`: session storage, redirect URLs, open redirects.
- `npm audit --omit=dev` results summarized by severity.

### P8. Architecture patterns and anti-patterns
Document what is good (keep it) and what should go. Evaluate at least:
- Single JSONB `payload` per room as the whole data model: conflicts, size growth, no per-entity permissions, no history/audit.
- Dual write paths: client autosave writes the full payload directly vs server domain layer `mutateRoom`. Which wins on conflict?
- `App.tsx` as orchestrator with heavy prop drilling; opportunities for context/store without breaking the golden rule.
- Next.js App Router used as a single client tree: missed server components, SSR, route-level code splitting.
- Types imported from hooks into server code (`RoomPayload` from `@/hooks/useRoom` in an API route) = layering violation.
- Duplicated business logic between client hooks and `src/server/domain/*`.
- Test coverage: which domains have tests, which critical paths do not.
For each anti-pattern: evidence, why it hurts multi-user, recommended pattern, effort (S/M/L), risk of change. Output: `ARCHITECTURE.md`.

### P9. Dead code and cleanup candidates
Find and list with evidence (unused imports/exports, unreferenced files): Vite leftovers (`src/assets/vite.svg`, `react.svg`, `hero.png`, README still says "React 19 + Vite" and `App.jsx`, "CSS variables inline"), mock/demo data shipped to production (`data/mockRoom.ts`, `data/initialDays.ts`, `mockPeople`), stale `tsconfig.tsbuildinfo` / `.next` in the repo, hardcoded trip-specific content (Wonder of the Seas, Nassau, CocoCay) that blocks generic use, unused shadcn components, dead hooks or utils. Mark each: DELETE / REPLACE / KEEP (with reason). Never delete; only list.

### P10. Scalability, reliability, data integrity
Realtime fan-out with many rooms, payload growth per trip, autosave frequency vs Supabase limits, offline/reconnect behavior, error handling and user feedback, backups and recovery of a room overwritten by mistake, observability (logs, errors), cost model per active user (Supabase + Vercel + Anthropic).

### P11. Feature opportunities
Given the current architecture and trajectory, propose features that fit how the app is built. For each: problem, user value, how it plugs into existing layers (which domain module, which `RoomPayload` field as optional, which agent tool), effort, dependency on P12 fixes. Group into:
- Required for multi-user (roles/permissions, invitations with expiring links, leave/remove member, room deletion/archiving, per-user settings, account deletion and data export).
- Collaboration (presence, activity log/history with undo per user, comments, votes on options, conflict indicators).
- Planning (templates for any trip type instead of cruise-specific, multi-currency, expense settlement "who owes whom", attachments/reservations, maps, ICS/Google Calendar export, sharing read-only links).
- AI agent (itinerary generation from a brief, budget optimizer, packing list, per-user agent quota, confirmation UX for destructive tools).
- Platform (onboarding, i18n ES/EN, mobile/PWA, analytics, usage limits/pricing tiers).

### P12. Readiness verdict and roadmap
Write `READINESS.md`:
- Verdict: GO / GO WITH CONDITIONS / NO-GO, one paragraph of reasoning.
- **Blockers** (must fix before any external user), **Before public launch**, **Later**.
- Each item links finding IDs, effort, and the order of implementation respecting `GUIDELINES.md` section 6 tech-debt backlog.
- A minimal "safe beta" scope: what to enable, what to hide (for example, disable agent for non-owners, invite-only rooms).

## 5. Finding format (FINDINGS.md)

One table, stable IDs, never renumber:

| ID | Area | Severity | Title | Evidence (path:line) | Impact for multi-user | Recommendation | Effort | Status |
|---|---|---|---|---|---|---|---|---|

- Area prefixes: `SEC-DATA`, `SEC-API`, `SEC-AI`, `SEC-CLIENT`, `ARCH`, `DEAD`, `REL`, `PERF`, `DX`.
- Severity: Critical (data exposure/loss for all users, trivial exploit), High, Medium, Low, Info.
- Status: `Open`, `Confirmed`, `Refuted` (with reason), `Fixed` (verified in code), `Stale` (code changed, needs recheck).

## 6. Validation pass (after all phases are checked)

Each validation iteration:
1. Diff since last pass: `git log --since` the last pass timestamp and `git diff` against the commit recorded in `STATE.md`. Record the current HEAD.
2. Re-check every `Open` / `Confirmed` finding against current code. Update status. A finding becomes `Fixed` only with new evidence.
3. Re-scan changed files with the relevant phase checklist (P4 to P9) to catch new issues.
4. Update `FEATURES.md` if features changed, and `READINESS.md` verdict if blockers moved.
5. Pick one area and go deeper than before (rotate: RLS, agent tools, API authz, XSS, concurrency, dead code). Log which one.
6. If the pass produced zero new findings and zero status changes, increment `Stable passes` in `STATE.md`; otherwise reset it to 0.

## 7. Exit criteria

Stop the loop (and say so clearly in the final message) when all are true:
- Phases P1 to P12 are checked.
- `Stable passes >= 2`.
- Every finding has status other than `Open` (it is `Confirmed`, `Refuted`, or `Fixed`).
- `READINESS.md` has a verdict and a prioritized roadmap.

When exiting, write a 10-line executive summary at the top of `READINESS.md`: verdict, count of findings by severity, top 5 blockers, estimated effort to safe beta.

## 8. Per-iteration final message

End each run with at most 6 lines: iteration number, phase done, new/changed findings by severity, the single most important thing learned, next action.
