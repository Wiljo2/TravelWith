# UX wave 1 progress
- Iteration: 3
- Last commit: (iteration 3 commit; see log)
- Next step: L.V
- Human actions pending: set `NEXT_PUBLIC_SITE_URL` in Vercel if the app uses a custom domain (otherwise the Vercel production domain is used)

## Steps
- [x] L.1 Entry split: server `page.tsx` + `EntryGate` + `shouldEnterApp()`
- [x] L.2 Landing sections (`src/components/landing/*`)
- [x] L.3 SEO: metadata, OG image, robots, sitemap
- [ ] L.V Verify landing (desktop + 375px, no flash for signed-in / `?local=1`)
- [ ] H.1 `actions.ts` (tool kinds, Spanish summaries) + `pending.ts` (HMAC resume token)
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
