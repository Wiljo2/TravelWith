# UX wave 1 progress
- Iteration: 12
- Last commit: (iteration 12 commit; see log)
- Next step: I.4
- Human actions pending: (0) apply `supabase/migrations/020_item_icons.sql` on production BEFORE deploying this branch (choosing an icon fails without it; plain creates keep working); (1) set `AGENT_RESUME_SECRET` in Vercel and run `docs/plans/ux-wave-hitl-check.md` (H.V); (2) set `NEXT_PUBLIC_SITE_URL` in Vercel if the app uses a custom domain (otherwise the Vercel production domain is used)

## Steps
- [x] L.1 Entry split: server `page.tsx` + `EntryGate` + `shouldEnterApp()`
- [x] L.2 Landing sections (`src/components/landing/*`)
- [x] L.3 SEO: metadata, OG image, robots, sitemap
- [x] L.V Verify landing (desktop + 375px, no flash for signed-in / `?local=1`)
- [x] H.1 `actions.ts` (tool kinds, Spanish summaries) + `pending.ts` (HMAC resume token)
- [x] H.2 Agent loop pause/resume, `confirm` frame, destructive gate removed
- [x] H.3 Prompt + tool descriptions static text for approval flow
- [x] H.4 Client `useAgentChat` + `AgentConfirmCard`
- [H] H.V Verify HITL end to end (HUMAN if no API key; HUMAN: set `AGENT_RESUME_SECRET`)
- [x] I.1 Icon catalog + `suggestIcon` / `eventIcon` / `taskIcon`
- [H] I.2 Persistence: migration 020 `icon` on events + tasks, full read/write path (HUMAN: apply 020 before deploy)
- [x] I.3 Render icons in calendar, agenda, home, tasks
- [ ] I.4 `IconPicker` in event and task editors
- [ ] I.V Verify icons (old trip, override persists, syncs)
- [ ] S.1 `OpQueue`: `lastSavedAt` + `send` ack promise
- [ ] S.2 `Snackbar` + `useSnackbar`, save/delete messages, Deshacer on delete
- [ ] S.3 Header indicator on mobile + "Guardado · hace X"
- [ ] S.V Verify save feedback
- [ ] F.1 Docs, `.env.example`, PR description draft (HUMAN: migration, env, push, PR)

## Log
| Iter | Date | Step | Commit | Result | Notes / blockers |
|---|---|---|---|---|---|
| 1 | 2026-10-09 | L.1 | (this commit) | tsc ok, 402 tests ok, lint 0 errors, build ok | Inline pre-paint script (`entryScript.ts`) hides the landing for likely app users; EntryGate clears the flag when the landing stays (fixes blank page for `?local=1` in production). CTA links to `/?app=1`; installed PWA always enters the app. Not yet checked in a browser (L.V). |
| 2 | 2026-10-09 | L.2 | (this commit) | tsc ok, 402 tests ok, lint 0 errors, build ok (`/` static) | 10 server-component sections in `src/components/landing/` (nav, hero + HTML mock, 8 features, how it works, assistant approval mock, demo video slot behind `NEXT_PUBLIC_DEMO_VIDEO_URL`, FAQ, final CTA, footer). Orchestrator fixed the offline FAQ answer (offline is read-only). Copy to be reviewed by a human. |
| 3 | 2026-10-09 | L.3 | (this commit) | tsc ok, 405 tests ok, lint 0 errors, build ok (`/opengraph-image`, `/robots.txt`, `/sitemap.xml` static) | Done by the orchestrator (small step). `src/lib/site.ts` (`siteUrl()`: `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → localhost), OG/Twitter metadata, generated OG image (no emoji, no external fonts) checked visually. No CSP change needed. |
| 4 | 2026-10-09 | L.V | (this commit) | all pass (dev server + Playwright, 1280px and 375px) | Anonymous `/` shows the landing, no horizontal scroll at 375px, sticky nav OK, `og:image` present. `?local=1` sets `data-entry=app` before paint and opens the demo trip; a Supabase session key in storage goes straight to the app; CTA `/?app=1` opens RoomGate sign-in. Note: `next dev` appends an agent-rules block to `CLAUDE.md`; the loop reverts it after each dev-server run (HUMAN decision: commit it or set `agentRules: false`). |
| 5 | 2026-10-09 | H.1 | (this commit) | tsc ok, 426 tests ok, lint 0 errors (no app code wired yet, build skipped) | `actions.ts` (tool kinds, unknown → write; pure Spanish summaries over the trip payload) + `pending.ts` (base64url JSON + HMAC-SHA256, 15 min TTL, bound to code + user, 400 KB cap; prod without `AGENT_RESUME_SECRET` fails closed). Orchestrator removed the redundant "USD" suffix (`fmtUSD` already prints `US$`). Plan updated: `describeAction` takes the loaded trip. |
| 6 | 2026-10-09 | H.2 | (this commit) | tsc ok, 435 tests ok, lint 0 errors, build ok | Loop moved to `src/server/agent/loop.ts`; reads run, writes/deletes pause with a `confirm` frame (token + actions) and only run on `{ resume: { token, decisions } }`; missing decision = rejected. Beta destructive gate removed (`AGENT_DESTRUCTIVE_TOOLS` gone). Orchestrator restored the escaped `\n\n` SSE separator (the subagent had turned it into literal newlines, which CRLF checkouts would break) and documented `AGENT_RESUME_SECRET` in `.env.example`. Accepted limit: tokens are not single-use (noted in the plan). |
| 7 | 2026-10-09 | H.3 | (this commit) | tsc ok, 435 tests ok, lint 0 errors, build ok | Done by the orchestrator (static text). System prompt: write tools are proposals the user approves, so call them directly, batch one request's changes in one turn, don't retry rejected actions. Removed "confirm before deleting several" from delete tool descriptions. Prompt stays a module-load constant (byte-stable from here on). |
| 8 | 2026-10-09 | H.4 | (this commit) | tsc ok, 446 tests ok, lint 0 errors, build ok | `useAgentChat` hook + pure `agentChat.ts` (frame reducer, history with a `[Propuesta: … → aprobada/rechazada/expirada]` trace so the model knows the outcome), `AgentConfirmCard` (checkbox per action, "Aprobar (n)" / "Rechazar todo", locks on first decision, 400 on resume → expirada), `AgentMessageBubble` split out; `AgentPanel` 233 → 119 lines; chat types moved to `src/types`. Orchestrator: create/edit icon now comes from the tool name, not the Spanish summary. |
| 9 | 2026-10-09 | H.V | (this commit) | prepared, waiting for a human | The assistant needs a real API key, an owner session and real writes (the loop may not write remotely; local mode has no assistant). Manual checklist with 9 cases in `docs/plans/ux-wave-hitl-check.md`. Server behaviour is covered by the H.2 route tests. |
| 10 | 2026-10-09 | I.1 | (this commit) | tsc ok, all tests ok, lint 0 errors (no app code wired yet, build skipped) | `ITEM_ICONS` (44 ordered keyword entries, Spanish + English, whole-word match via the exported `asWords`), `ICON_CHOICES` (50, no duplicates), `suggestIcon` / `eventIcon` / `taskIcon` (stored icon → title → category / 📍). Meals before café, transport before hotel. |
| 11 | 2026-10-09 | I.2 | (this commit) | tsc ok, 481 tests ok, lint 0 errors, build ok; 020 parsed with libpg-query (top level + get_trip body + DO-block statements) | Migration 020: nullable `icon` + `char_length` 1..16 checks on `trip_events`/`trip_tasks`; `get_trip` copied from 019 (diff = the two `'icon'` lines); `trip_payload` intentionally unchanged (cosmetic). Validators (`iconArg`, null/"" = automatic), `database.ts`, `tripRows`, client types, hooks. Audit/broadcast triggers send whole rows. Orchestrator: inserts omit `icon` unless chosen (`optionalIcon`), so creates don't depend on 020 being applied first. `[H]`: apply 020 before deploy; later steps proceed. |
| 12 | 2026-10-09 | I.3 | (this commit) | tsc ok, 481 tests ok, lint 0 errors, build ok | `eventIcon` before event titles (calendar block, day agenda, itinerary agenda, today card, ideas-by-day groups) and `taskIcon` replacing the category icon next to task titles (calendar task block, tasks view, home, agenda). Emojis `aria-hidden`. Skipped: editable title inputs (picker goes there in I.4) and map lists (they show place names). Orchestrator moved the ideas-group emoji to its own `aria-hidden` field instead of the title string. |
