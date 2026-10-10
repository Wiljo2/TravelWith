# Reel insights: from "9 reels I must watch" to usable trip knowledge

Status: approved · Branch: `feature/reel-insights` (from current HEAD) · Date: 2026-10-10
Loop docs (created in step 0.1): `docs/plans/reel-insights.md` (this plan, English) + `docs/plans/reel-insights-progress.md` (checklist, same format as `ux-wave-progress.md`).

## Context

Ideas today = one card per reel (or one child card per spot when Gemini finds ≥2 spots, up to 12). The analysis keeps only **spots** (places); everything else a reel says — advice, things to book/buy, warnings, prices, time-of-day tips — is squashed into a 600-char `video.summary` nobody reads. On a real trip (Crucero: 9 reels) the group can't tell what each reel contributes without watching them all, and the advice that matters most is time-bound ("embarkation day 11:30–13:00 eat at the deck-14 buffet").

Outcome: each short reel becomes a handful of **insights** (todo / tip / avoid / fact, plus the existing spots), each anchored to *when* it matters in the trip and linked to the second of the video that says it; the board shows a per-destination digest instead of a wall of covers; insights show up on the calendar and on "Hoy" during the trip; todos become tasks.

Decisions taken with the user:
- **Only short videos**: TikTok / Instagram reels **≤ 90 s** are analyzed; longer ones are skipped with a clear message. **YouTube is not analyzed** (we can't know its length).
- Insight model, digest, anchoring, calendar/Hoy, tasks and consolidation: all approved; build everything as an autonomous loop.

## Loop protocol

- Each iteration reads `docs/plans/reel-insights-progress.md`, takes the next `[ ]` step, implements it, then runs `npx tsc --noEmit`, `npm test`, `npm run lint`. Green → commit (`feat(ideas): …`, English, attribution trailer) and tick the step; red → fix within the iteration.
- Steps marked **[H]** need a person (apply a migration to Supabase, set env, provide reels, push/PR). The loop writes what is needed under "Human actions pending" and continues with the next independent step.
- Hard rules from `CLAUDE.md` / `GUIDELINES.md` §2 apply to every step: optional fields with read-time defaults, additive migrations only (next number **023**), no file > ~400 lines, theme tokens + shadcn, Spanish UI copy, `@/` imports, writes only through `runOp`.
- Each phase ends with a `.V` verification step (browser via `npm run local:mock` / Playwright when possible; otherwise [H]).

---

## Phase 0 — Loop setup + evaluation harness

- **0.1** Create branch `feature/reel-insights`; copy this plan to `docs/plans/reel-insights.md` and create the progress file.
- **0.2** Live eval harness: `src/server/video/insights.eval.test.ts`, skipped unless `RUN_VIDEO_EVAL=1` and `GEMINI_API_KEY` are set. Reads `evals/reel-insights/cases.json` (`[{ url, places: string[], expected: { insights: [{kind,text,phase?}], spots: [name] } }]`), runs `resolveVideo` + `watchVideo` per case and prints a table: found / missed / invented per kind + raw JSON to `evals/reel-insights/out/` (gitignored). Matching = normalized-token overlap ≥ 0.5 (reuse `normalizeText`/`vocab` from `src/utils/ideas.ts`).
- **0.3 [H]** User provides the 9 Crucero reel links (or `npm run snapshot` of the trip) and annotates expected insights in `cases.json` (the loop pre-fills a template from the current analysis to edit). Not blocking: the loop continues; prompt tuning (1.6) re-runs when this is done.

## Phase A — 90 s limit, no YouTube

- **A.1** Server limit. `src/server/video/config.ts`: `DEFAULT_MAX_SECONDS = 90`. Check duration **before downloading**: `fetchTikTokVideo` (`src/server/tiktok.ts`) gets `maxSeconds` and returns a `tooLong` result right after `fetchItem` (duration is known there); `fetchInstagramPost` (`src/server/video/instagram.ts`) checks `item.videoDuration` before the CDN download. `resolveVideo` (`src/server/video/sources.ts`) maps both to `{ ok:false, status:"skipped", reason:"Solo analizamos videos de hasta 90 segundos", skip:"tooLong" }`; the post-download check in `analyze.ts` stays as a fallback. Unknown duration → analyze as today.
- **A.2** YouTube: `resolveVideo` returns `skipped` with `reason:"Por ahora no analizamos videos de YouTube"`, `skip:"platform"`, without calling Gemini (skips don't count toward the daily quota: `videosAnalyzedToday` counts `ok=true` only). Client: `isAnalyzingVideo` (`src/utils/ideaVideo.ts`) returns false for YouTube (no spinner); `IdeaVideoPanel` hides "Ver el video con IA" for YouTube. Existing YouTube/long analyses that are `done` are kept.
- **A.3** Types + UI. `IdeaVideo.skip?: "tooLong" | "platform"` (`src/types/index.ts`; idea data is opaque JSON, `ideaData` in `featureRows.ts` needs no change). `IdeaVideoPanel`: when `skip` is set, show the reason with a ⏱ icon and **no Reintentar**. Uploads: before `onUpload`, read the file duration with a detached `<video>` `loadedmetadata`; > 90 s → inline error "El video dura más de 90 s; recórtalo o sube uno más corto" (server accepts uploads as today, bounded by 100 MB). `AddIdeaForm`: helper line "La IA analiza TikToks y reels de hasta 90 s". Agent `add_idea` description (`src/server/agent/ideaTools.ts`): mention the 90 s limit and that YouTube isn't analyzed (tool text only; `prompt.ts` untouched).
- **A.4** Tests: `analyze.test.ts` / new `sources.test.ts` (tooLong TikTok + Instagram before download, YouTube skipped without Gemini), `ideaVideo` test for YouTube not analyzing. Update `docs/ideas-flow.md` (diagram: limit + YouTube).
- **A.V** Verify: a >90 s TikTok shows the message without Reintentar; a YouTube idea shows no spinner and the "no analizamos YouTube" note; a short TikTok still analyzes. **[H]** if `VIDEO_MAX_SECONDS` is set in Vercel, set it to 90 or remove it.

## Phase 1 — Insight extraction (Gemini)

Data (all optional, inside `idea.video`, no migration):
```ts
export type InsightKind = "todo" | "tip" | "avoid" | "fact";
export type InsightPhase = "before" | "first" | "during" | "last" | "anytime";
export interface IdeaInsight {
  kind: InsightKind;
  text: string;            // ≤ 160, Spanish, one actionable sentence
  phase?: InsightPhase;    // before the trip · first day there · while there · last day · any time
  when?: string;           // as the video says it: "60 días antes", "el día de embarque al mediodía" (≤ 80)
  start?: number; end?: number; // decimal hours when stated
  place?: string;          // trip place / venue it's about (≤ 60)
  brand?: string;          // line/ship/park it is specific to: "Royal Caribbean" (≤ 60)
  at?: number;             // second of the video
}
// IdeaVideo.insights?: IdeaInsight[]
```
Places stay in `spots` (unchanged) — insights never duplicate them.

- **1.1** Constants `src/constants/insightKinds.ts` (typed Record: todo ✅ "Por hacer", tip 💡 "Consejo", avoid ⚠️ "Evitar", fact ℹ️ "Dato") and `INSIGHT_PHASES` labels ("Antes del viaje", "Primer día", "Durante", "Último día", "Cuando sea"). Types in `src/types/index.ts`.
- **1.2** `src/server/video/analysis.ts` (split into `analysisPrompt.ts` if it passes ~400 lines): schema gains `insights` (max `MAX_INSIGHTS = 8`); `parseInsight` validates kind/phase enums, clamps lengths, drops empty or duplicate texts, validates hours 0–24 with `end > start`. `doneVideo` stores them.
- **1.3** Prompt rewrite for short reels (`analysisPrompt(places, context)`):
  - read **every on-screen text** as a source, not only audio; each item of a list ("5 errores…") is its own insight;
  - **specificity rule**: keep only insights with a name, number, time, place or concrete action; drop generic advice ("disfruta");
  - `brand` when the advice is specific to a company/ship/park;
  - no invention; Spanish output; humor/POV reels may return 0 insights.
  - Context passed in: the trip places (as today) + the idea's caption (`title`) and TikTok `transcript` excerpt (`transcriptExcerpt` from `src/utils/excerpt.ts`, ~600 chars) — captions often list what the video shows. `watchVideo` (`gemini.ts`) and `analyze.ts` pass the idea through.
- **1.4** Viewer: `IdeaVideoPanel` lists insights grouped by kind (icon, text, `when`/hours, `▶ m:ss` using `fmtVideoTime`) above the summary; summary collapses under "Resumen". Split `InsightList.tsx` out to keep files small.
- **1.5** Card: `IdeaCard` shows "aporta" chips from the parent video — e.g. `✅1 💡4 📍2` — and "Sin datos útiles" when `relevant === false` or nothing was extracted. Spot children keep their current look. Agent `get_ideas` (`src/server/agent/ideaTools.ts`) includes `video.insights` (compact form).
- **1.6** Tests: `analysis.test.ts` (parse/clamp/dedupe/limits/hours), prompt snapshot. When 0.3 is done: run the eval, iterate the prompt until on the Crucero set ≥ 80 % of expected insights are found and ≤ 1 invented per reel; record the numbers in the progress file. **[H]** Re-analyze existing short reels (button "Ver el video con IA" / Reintentar) — costs Gemini quota.
- **1.V** Verify on a known short cruise reel: insights appear in the viewer and as chips on the card; an old idea without `insights` renders as before.

## Phase 2 — Destination digest ("Lo que aportan los videos")

- **2.1** Pure `src/utils/insights.ts` (+ tests): `collectInsights(allIdeas, index, days)` → per zone (reuse `zonesOf`/zone logic from `IdeasView`; a split video's zone = majority zone of its spot children, else its own place/suggestion) the list of `{ ideaId, idx, insight }` and deduplicated spots (normalized name, list of source idea ids). Insight id = `${ideaId}:i${idx}`. Near-duplicate texts across reels merged with token Jaccard ≥ 0.6 → `sources: ideaId[]`.
- **2.2** Moment grouping: map `phase` to the trip's real days: `before` → "Antes del viaje"; `first`/`last` → first/last day of that zone (use `dayPhases` from `src/server/ideaPlan.ts` — move it to `src/utils/` so the client can use it — so the cruise shows "Embarque", "Desembarque"); `during` → "Durante"; items with hours sorted by `start`.
- **2.3** UI: new `src/components/ideas/IdeasDigest.tsx` (+ `DigestSection.tsx`): per zone a panel with header "🛳️ Crucero · 9 videos → N datos", sections ✅ Por hacer, ⚠️ Evitar, 🕐 Por momento, ℹ️ Datos, 📍 Lugares, 🎬 Videos (existing `IdeaCard` row). Each line: text, `when`, source count `▶×n`; tap ▶ opens `IdeaViewer` for that idea with the insight highlighted (and seeks to `at` when the player supports a start time; otherwise shows "en el segundo m:ss").
- **2.4** `IdeasView`: third toggle "✨ Resumen" next to "📍 Por lugar" / "📅 Por día"; default view = Resumen when any insight exists. Keep `IdeasView` < 400 lines (move the view toggle + filter chips into a subcomponent if needed).
- **2.V** Verify with the Crucero data (or `local:mock` fixture with 3 analyzed reels): digest groups by zone and moment, ▶ opens the right reel, mobile 375 px has no horizontal scroll.

## Phase 3 — Anchor insights to the plan (Claude)

- **3.1** Extend "Analizar con Claude" (`src/server/ideaPlan.ts`, route `src/app/api/rooms/[code]/idea-plan/route.ts`): the prompt also lists each insight with a label `I{n}` (text, kind, phase, when, hours, place, brand). Output per insight: `target` (e…/s…/D…/none, same labels and validation as ideas), `before`, `deadline?` (ISO date, only for todos with a lead time — computed from `when` + trip dates), `status: "new" | "covered" | "na"` (covered = the plan already has it; na = other brand/ship, a port they don't visit, other airport direction), `reason` (≤ 16 words). The static SYSTEM text gains the insight rules (still byte-stable after this step; cached block). Cap insights per call (e.g. 120) and sort by most recent.
- **3.2** Persistence, mirroring `ideaLinks` (GUIDELINES §2 checklist): migration `023_insight_links.sql` adds nullable `rooms.insight_links jsonb` (+ size check), `get_trip` copied from the latest version adding it, `src/types/database.ts`, header op (same op family that saves `ideaLinks` via `onSavePlan`), `utils/tripRows.ts`, `RoomPayload.insightLinks?: InsightLink[]`, hook optimistic update + `applyRow`. `InsightLink = { insightId, dayId?, eventId?, slot?, before?, deadline?, status, reason, source: "claude" }`. Links whose insight no longer exists (re-analysis) are ignored at read time. **[H]** apply 023 before deploying.
- **3.3** Digest uses the links: "🆕 nuevo" first, "✔️ ya en el plan" collapsed, "🚫 no aplica" hidden behind "ver n"; "Por momento" groups by the real day/activity instead of the coarse phase when a link exists; todos show the deadline.
- **3.4** Tests: prompt build + answer parsing/validation (`ideaPlan.test.ts`, `route.test.ts`), old trips without `insight_links` load.
- **3.V** Verify: run Analizar con Claude on Crucero; embarkation tips land on embarkation day/activity; an advice about another cruise line is "no aplica".

## Phase 4 — Insights where they're used: calendar, Hoy, tasks

- **4.1** Calendar: `EventBlock` (`src/components/calendar/EventBlock.tsx`) and the agenda views show `💡n` when insight links target the event (slot links on the day header). Tap → popover / bottom sheet listing them with ▶ (shared `InsightList`).
- **4.2** Hoy: `TodayCard` / `HomeView` (`src/components/home/`) during the trip (`phase === "during"`) show "Consejos para hoy": today's linked insights, upcoming hours first, max 5 + "ver todos".
- **4.3** Todos → tasks: in the digest, "Pasar a tareas" on a todo (and a bulk button for all new todos) creates a `Task` via the existing `task.create` op (`src/server/ops/tasks.ts`): title = text, note = `when` + reel link, priority `alta` if the deadline is < 14 days away. Already converted = a task with the same normalized title exists (no new state needed until Phase 5).
- **4.V** Verify calendar badge, Hoy card (fake today inside the trip in `local:mock`), task creation and sync to a second tab.

## Phase 5 — Group triage, consolidation, fewer child cards

- **5.1** Table `trip_insight_states` (migration `024`): `(room_code, id = insightId)`, `version`, `data jsonb` `{ status?: "useful" | "known" | "dismissed" | "done", votes?: string[], taskId?: string }`, RLS + audit + broadcast triggers like `trip_ideas` (018). Full GUIDELINES §2 path: `database.ts`, validator in `featureRows.ts`, repo `src/server/repo/insightStates.ts`, ops `insight.setStatus` / `insight.vote`, `get_trip`, `tripRows.ts`, hook `useInsightStates` composed in `App.tsx` with optimistic updates + `applyRow`. **[H]** apply 024.
- **5.2** Digest controls per insight: 👍 útil · "ya lo sabíamos" · ✕; dismissed/known collapse; "Guía del viaje" filter = useful ones, ordered by moment (copy as text to share on WhatsApp).
- **5.3** Cross-reel consolidation with Claude: the Phase 3 call also returns `group` ids for insights that say the same thing; the digest merges them (`▶×n`), contradictions flagged ("los videos no coinciden").
- **5.4** Stop automatic spot children: `childIdeas` (`src/server/video/analysis.ts`) no longer runs on new analyses; spots live in the digest with "+ Guardar como idea" (creates the child on demand, id = `${parentId}-s-${slug(name)}`, validator in `ideaVideoArgs` accepts both id forms). Existing children untouched; `hideSplitVideos` keeps working for them.
- **5.V** Verify triage syncs across tabs, merged insights, a new 5-spot reel creates no child cards.

## Phase F — Finish

- **F.1 [H]** Docs (`docs/ideas-flow.md`, `GUIDELINES.md` entities), `.env.example` (`VIDEO_MAX_SECONDS=90`), PR description draft in the progress file; human applies migrations 023/024, pushes and opens the PR.

---

## Ideas to discuss later (not in the loop)

- Higher frame rate for fast-cut reels (Gemini `videoMetadata.fps` ~2): catches on-screen text that flashes; reports say the parameter is flaky — spike first.
- "Qué dicen los videos de…" in the assistant: a `get_insights` read tool so it can answer "¿qué consejos hay para el día de embarque?".
- Feedback learning: dismissed/known insights as negative examples in the extraction prompt per trip.
- Push reminder for todos with a deadline / time-window tips the morning of that day (needs notifications).

## Critical files

`src/server/video/{analysis,analyze,sources,config,gemini}.ts`, `src/server/tiktok.ts`, `src/server/video/instagram.ts`, `src/types/index.ts`, `src/utils/ideaVideo.ts`, `src/components/ideas/{IdeaVideoPanel,IdeaCard,IdeasView,AddIdeaForm}.tsx`, new `src/components/ideas/{InsightList,IdeasDigest,DigestSection}.tsx`, new `src/utils/insights.ts`, `src/server/ideaPlan.ts` (+ route), `src/server/agent/ideaTools.ts`, `src/components/calendar/EventBlock.tsx`, `src/components/home/TodayCard.tsx`, migrations `023`, `024`.

## Verification (every step)

`npx tsc --noEmit` · `npm test` · `npm run lint` · open a trip created before the change (no `insights`, no `insight_links`) and check it loads and edits. Phase `.V` steps in the browser (`npm run local:mock`, Playwright; 375 px and desktop). Live Gemini eval via `RUN_VIDEO_EVAL=1 npx vitest run src/server/video/insights.eval.test.ts` once 0.3 is done.
