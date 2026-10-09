# UX wave 1 progress
- Iteration: 19
- Last commit: (iteration 19 commit; see log)
- Next step: none (loop done; HUMAN items below)
- Worktree: the loop runs in `../TravelWith-ux-wave` (the main checkout is on `feature/idea-video`).
- Human actions pending: (01) review the landing copy; (02) push `feature/ux-wave` and open the PR (draft below); (00) migration number clash: `feature/idea-video` also adds `020_idea_video.sql`; whichever branch merges second renumbers its file to 021; (0) apply `supabase/migrations/020_item_icons.sql` on production BEFORE deploying this branch (choosing an icon fails without it; plain creates keep working); (1) set `AGENT_RESUME_SECRET` in Vercel and run `docs/plans/ux-wave-hitl-check.md` (H.V); (2) set `NEXT_PUBLIC_SITE_URL` in Vercel if the app uses a custom domain (otherwise the Vercel production domain is used)

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
- [x] I.4 `IconPicker` in event and task editors
- [x] I.V Verify icons (old trip, override persists, syncs)
- [x] S.1 `OpQueue`: `lastSavedAt` + `send` ack promise
- [x] S.2 `Snackbar` + `useSnackbar`, save/delete messages, Deshacer on delete
- [x] S.3 Header indicator on mobile + "Guardado · hace X"
- [x] S.V Verify save feedback
- [H] F.1 Docs, `.env.example`, PR description draft (HUMAN: migration, env, push, PR)


## PR description (draft)

**UX wave 1: landing page, assistant approvals, item icons, save feedback**

### What
- **Landing page** for anonymous visitors at `/` (server-rendered, SEO + Open Graph image, robots, sitemap). Signed-in users, `?local=1`, offline snapshots, OAuth callbacks and the installed PWA go straight to the app; a pre-paint script avoids a landing flash. Demo video slot behind `NEXT_PUBLIC_DEMO_VIDEO_URL`.
- **Assistant approvals (HITL)**: write and delete tools never run on their own. The loop pauses with a `confirm` frame (Spanish summaries + signed resume token); the chat shows "Cambios propuestos" with a checkbox per action and "Aprobar (n)" / "Rechazar todo". Destructive tools are enabled again behind approval; `AGENT_DESTRUCTIVE_TOOLS` is gone.
- **Dynamic icons**: events and tasks show an emoji derived from the title (44 keyword entries, Spanish + English), overridable with a picker ("Automático" resets). New nullable `icon` column (migration 020).
- **Save feedback**: Google-Calendar-style snackbar after the server confirms creates, deletes (with "Deshacer"), completions and edits (once, when the editor closes); header shows "Guardando… / Guardado · hace X / Error al guardar", also on mobile.

### Before deploying
1. Apply `supabase/migrations/020_item_icons.sql` (renumber to 021 if `feature/idea-video` merges first with its own 020).
2. Set `AGENT_RESUME_SECRET` (required in production) and optionally `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEMO_VIDEO_URL`.

### Testing
- `tsc`, 494 unit tests, lint and `next build` pass on every step.
- Browser checks (local mode, 375px + 1280px): landing, icons + picker, snackbars + undo.
- Manual check still to run on a real trip: `docs/plans/ux-wave-hitl-check.md` (assistant approvals) plus icon persistence across tabs after 020.

### Known limits
- A resume token is not single-use within its 15 minutes (owner-only; the card locks after the first decision).
- Undo of a deleted event does not bring back cross-day spans or expense links removed by the delete.

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
| 13 | 2026-10-09 | I.4 | b02f6d7 | tsc ok, 481 tests ok, lint 0 errors, build ok | Loop paused once: the main checkout was switched to `feature/idea-video` (uncommitted work). With the user's OK, continued in a new worktree `../TravelWith-ux-wave`. `IconPicker` (inline panel, "Automático" + 8-column grid, suggested emoji first, Escape closes) wired left of the event title in `EventEditor` (saves immediately, like the title) and as an "Ícono" row in the task panel of `TasksView`. Skipped `SlotCreateModal`. Orchestrator made grid cells fluid for narrow screens. Progress update landed in a follow-up commit. |
| 14 | 2026-10-09 | I.V | (this commit) | pass (dev server in the worktree, `?local=1`, Playwright 1280px + 375px) | Demo trip renders auto emojis (✈️ vuelo, 🏨 check-in, 🍽️ cena, 🥐 desayuno, 🗺️ tour, 🏛️ museo; tasks ✈️/🏨/🧳). Event picker: 🍽️ → 🎉 updates the list, "Automático" restores 🍽️. Task picker: 🧳 → ⭐. At 375px the grid fits (right edge 323px), no horizontal scroll. Old trips: icon is optional, rows without it fall back automatically (covered by tripRows/row tests). Persistence/sync across tabs needs migration 020 on a real database (HUMAN, with H.V). |
| 15 | 2026-10-09 | S.1 | (this commit) | tsc ok, 486 tests ok, lint 0 errors, build ok | `OpQueue.send` returns `Promise<OpOutcome>` (ok / conflict / failed, never rejects); merged updates share their request's outcome; ops dropped behind a 409 resolve conflict; 503 stays pending until the retry settles. `lastSavedAt` set on every 200 and passed through `onState`; `useTripOps` exposes it; LOCAL room resolves ok immediately. |
| 16 | 2026-10-09 | S.2 | (this commit) | tsc ok, 492 tests ok, lint 0 errors, build ok | `Snackbar` + `useSnackbar` (one at a time, 4 s / 6 s with action, `aria-live`); `Toast.tsx`/`ToastAction` removed, drag undo migrated. Notifies only on outcome ok: Evento creado / eliminado (+Deshacer, same id) / guardado (once, when the editor closes after edits and `flush()` succeeds); Tarea creada / completada / eliminada (+Deshacer incl. options); Gasto agregado / guardado (row ✓) / eliminado. Deletes are hard (`delete_trip_row`), so restoring the same id is valid. Orchestrator: event undo also restores `documentId`. Not restored: cross-day spans and expense links removed by the delete. |
| 17 | 2026-10-09 | S.3 | (this commit) | tsc ok, 494 tests ok, lint 0 errors, build ok | Done by the orchestrator (small step). Header status: "Guardando…" / "Guardado" / "Error al guardar" now visible on mobile too (only "Al día" stays desktop-only); desktop adds "· hace N min / h" from `lastSavedAt` via `useNow`; `role=status` + `aria-live`. Pure helpers in `src/utils/syncLabel.ts` with tests. |
| 18 | 2026-10-09 | S.V | (this commit) | pass (dev server in the worktree, `?local=1`, Playwright 375px + 1280px) | Task delete → "Tarea eliminada · Deshacer" → restored ("Tarea restaurada"). Event delete → "Evento eliminado · Deshacer" → restored ("Evento restaurado"). Editing an event title shows no snackbar per keystroke; closing the editor (button, Escape, backdrop) or switching events shows one "Evento guardado". No horizontal scroll at 375px. Header indicator is hidden in local mode; covered by S.3 unit tests and the HUMAN check on a real trip. Note: `TaskStop` does not kill the `next dev` child process on Windows; the loop now stops it by PID. |
| 19 | 2026-10-09 | F.1 | (this commit) | docs only | `GUIDELINES.md` (agent frames/resume body, chat trace, save feedback rules, item emoji rule), `CLAUDE.md` agent bullet (approval flow), `.env.example` (`NEXT_PUBLIC_DEMO_VIDEO_URL`), PR description draft above. `[H]`: push + PR, migration 020, env vars, landing copy review, H.V manual check. Loop finished. |
