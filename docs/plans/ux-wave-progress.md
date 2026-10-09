# UX wave 1 progress
- Iteration: 5
- Last commit: (iteration 5 commit; see log)
- Next step: H.2
- Human actions pending: set `NEXT_PUBLIC_SITE_URL` in Vercel if the app uses a custom domain (otherwise the Vercel production domain is used)

## Steps
- [x] L.1 Entry split: server `page.tsx` + `EntryGate` + `shouldEnterApp()`
- [x] L.2 Landing sections (`src/components/landing/*`)
- [x] L.3 SEO: metadata, OG image, robots, sitemap
- [x] L.V Verify landing (desktop + 375px, no flash for signed-in / `?local=1`)
- [x] H.1 `actions.ts` (tool kinds, Spanish summaries) + `pending.ts` (HMAC resume token)
- [ ] H.2 Agent loop pause/resume, `confirm` frame, destructive gate removed
- [ ] H.3 Prompt + tool descriptions static text for approval flow
- [ ] H.4 Client `useAgentChat` + `AgentConfirmCard`
- [ ] H.V Verify HITL end to end (HUMAN if no API key; HUMAN: set `AGENT_RESUME_SECRET`)
- [ ] I.1 Icon catalog + `suggestIcon` / `eventIcon` / `taskIcon`
- [ ] I.2 Persistence: migration 020 `icon` on events + tasks, full read/write path (HUMAN: apply 020 before deploy)
- [ ] I.3 Render icons in calendar, agenda, home, tasks
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
