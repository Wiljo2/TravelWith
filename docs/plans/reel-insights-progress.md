# Reel insights progress
- Iteration: 6
- Last commit: (see log)
- Next step: none (loop done; HUMAN items below)
- Browser checks run on `?local=1` with a generated `public/local-snapshot.json` (gitignored; Florida & Bahamas fixture + sample ideas).
- Deviations from the plan: no migrations. Insight links live in the existing `rooms.idea_plan` jsonb (spread by `get_trip`) and the group's votes/hiding on the video idea (`Idea.insightStates`, like `Idea.votes`), so 023/024 were not needed.
- Human actions pending: (0.3) provide the Crucero reel links and annotate `evals/reel-insights/cases.json`, then run the eval and tune the prompt; (1) if `VIDEO_MAX_SECONDS` is set in Vercel, set it to 90 or remove it; (2) on a preview, re-analyze a few short reels (Ver el video con IA / Reintentar; uses Gemini quota) and run "Analizar con Claude → todo de nuevo" once, checking the placements make sense (the real Gemini and Claude calls were not run locally); (3) push the branch and open the PR

## Steps
- [x] 0.1 Branch, plan copy, progress file
- [x] 0.2 Live eval harness (`insights.eval.test.ts`, `evals/reel-insights/cases.json`)
- [H] 0.3 Crucero reels annotated (human)
- [x] A.1 90 s limit checked before download (TikTok, Instagram)
- [x] A.2 YouTube not analyzed (server + client)
- [x] A.3 `IdeaVideo.skip`, panel without Reintentar, upload duration check, form hint, agent tool text
- [x] A.4 Tests + `docs/ideas-flow.md`
- [x] A.V Verify limit and YouTube in the browser
- [x] 1.1 Insight constants + types
- [x] 1.2 Schema, parser, `doneVideo`
- [x] 1.3 Prompt for short reels + caption/transcript context
- [x] 1.4 Viewer insight list
- [x] 1.5 Card "aporta" chips + agent `get_ideas`
- [x] 1.6 Tests (eval tuning re-runs when 0.3 is done)
- [x] 1.V Verify extraction in the browser
- [x] 2.1 `utils/insights.ts` collect + dedupe
- [x] 2.2 Moment grouping (`byMoment` + `momentLabel`; cruise first/last = Embarque/Desembarque; real days come with 3.3)
- [x] 2.3 `IdeasDigest` + `DigestSection`
- [x] 2.4 "✨ Resumen" view toggle
- [x] 2.V Verify digest
- [x] 3.1 Claude anchoring of insights
- [x] 3.2 `insightLinks` persistence — inside the existing `rooms.idea_plan` jsonb (get_trip already spreads it): no migration needed
- [x] 3.3 Digest uses links (new / covered / n.a., deadlines)
- [x] 3.4 Tests
- [x] 3.V Verify anchoring
- [x] 4.1 Calendar 💡 badges
- [x] 4.2 "Consejos para hoy" (during) + "Antes del viaje" todos by deadline (before)
- [x] 4.3 Todos → tasks
- [x] 4.V Verify calendar, Hoy, tasks
- [x] 5.1 Insight votes and hiding — stored on the video idea (`Idea.insightStates`, same pattern as `Idea.votes`): no table or migration needed
- [x] 5.2 Triage controls (👍, hide/restore) + "Copiar la guía del grupo"
- [x] 5.3 Cross-reel consolidation (Claude `same`/`contradicts` → merged lines, "otro video dice lo contrario")
- [x] 5.4 No automatic spot children; on-demand "Guardar como idea" (`spotIdea`, id `<video>-s-<name>`); old `-s<n>` children keep hiding their video
- [x] 5.V Verify triage + consolidation
- [x] F.1 Docs (`docs/ideas-flow.md`, `GUIDELINES.md`), `.env.example` (`VIDEO_MAX_SECONDS=90`), PR draft below
- [H] F.2 Push and PR (human)

## PR description (draft)
# Reel insights: what each short video brings to the trip

Branch: `feature/reel-insights` · Plan: `docs/plans/reel-insights.md`

## Why
The ideas board showed one card per reel (or up to 12 spot cards per reel), and everything a reel said besides places was lost in a 600-character summary. On a real trip (9 cruise reels) the group had to watch every video to know what it was about, and the advice that matters most is tied to a moment of the trip.

## What
- **Only short videos**: TikTok and Instagram reels up to 90 s are analyzed (duration checked before downloading); longer ones and YouTube are skipped with a clear message and no Reintentar. Uploads are checked in the browser.
- **Insights**: Gemini returns, besides spots, up to 8 concrete pieces of advice per video (todo, tip, avoid, fact) with when they matter, hours and the second of the video. The prompt reads on-screen text, splits list videos item by item, drops generic advice and gets the caption and transcript as context.
- **Digest ("✨ Resumen")**: per destination, Por hacer / Evitar / Consejos por momento / Datos / Lugares, with the videos last. Repeated advice and places are shown once with their count.
- **Analizar con Claude** also places each insight: activity, free slot or day, before the trip, deadline for todos, and whether it's new, already covered or not for this trip; it merges the same advice across videos and flags opposites.
- **Where it's used**: 💡 count on calendar and agenda activities, advice in the activity detail, "Antes del viaje" and "Consejos para hoy" on Home, todos to Pendientes.
- **Group triage**: vote or hide each insight; "Copiar la guía del grupo" copies the voted advice.
- **No automatic spot cards**: places become ideas only with "Guardar como idea". Old split videos keep working.

## Data
No migrations. `IdeaVideo.insights`, `IdeaVideo.skip` and `Idea.insightStates` are optional fields inside `trip_ideas.data`; `insightLinks` is a new key of `rooms.idea_plan`. Old trips load unchanged.

## Test plan
- [x] `npx tsc --noEmit`, `npm test` (547), `npm run lint`
- [x] Browser (`?local=1`, 375 px and desktop): digest, viewer, skip messages, calendar badge, activity detail, Home before/during, todo → task, vote/hide, save spot
- [ ] Preview: re-analyze real short reels and run Analizar con Claude once
