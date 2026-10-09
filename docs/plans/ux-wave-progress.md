# UX wave 1 progress
- Iteration: 0
- Last commit: (plan commit)
- Next step: L.1
- Human actions pending: none

## Steps
- [ ] L.1 Entry split: server `page.tsx` + `EntryGate` + `shouldEnterApp()`
- [ ] L.2 Landing sections (`src/components/landing/*`)
- [ ] L.3 SEO: metadata, OG image, robots, sitemap
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
