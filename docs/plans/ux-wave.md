# UX wave 1: landing, agent HITL, dynamic icons, save feedback

Status: approved · Base: `chore/post-cutover` (718de9a) · Branch: `feature/ux-wave` · Date: 2026-10-09

## Context

Four product ideas, to be built by an autonomous `/loop` in which **Opus orchestrates and Sonnet 5.5 subagents implement**:

1. **Landing page** at `/` for anonymous visitors (features showcase; a demo video comes later, leave a slot).
2. **HITL for the AI assistant**: every write/delete tool call needs user approval. Today tools run immediately and deletes are simply disabled (`DESTRUCTIVE_TOOLS` + `AGENT_DESTRUCTIVE_TOOLS` in `src/server/agent/tools.ts:21-27`).
3. **Dynamic emoji icons** for events and tasks, derived from the title, with a user override.
4. **Google-Calendar-style save feedback**: snackbar "Evento guardado" (+ Deshacer where possible) and the header indicator visible on mobile with "Guardado · hace X".

Decisions taken with the user: landing on `/` only for anonymous visitors; HITL on all writes + deletes; icons on events + tasks; snackbar + header indicator.

## Steps

### Phase L — Landing page
- **L.1** Entry split. `src/app/page.tsx` becomes a server component rendering `<EntryGate landing={<Landing />} />`. `EntryGate` (client, `src/components/landing/EntryGate.tsx`) renders the SSR landing by default and, before paint (`useLayoutEffect`), switches to `<App />` when: a Supabase session exists in storage, `?local=1`, an offline snapshot exists (`lastSnapshotCode()` in `src/lib/offline.ts`), or the OAuth callback is in the URL. CTA "Empezar" → `<App />` (shows `RoomGate` sign-in). Pure decision fn `shouldEnterApp()` with tests. Update `GUIDELINES.md` §1 ("page.tsx only mounts App"). PWA `start_url` and OAuth redirect unchanged.
- **L.2** Sections in `src/components/landing/*` (server components, Spanish copy, theme tokens, lucide icons, no new assets): Hero (tagline + CTA + illustrative UI mock built with HTML/CSS), Features grid (itinerary calendar w/ drag-drop, map + offline, ideas board + "Analizar con Claude", budget USD↔COP per person, tasks/decisions → event+expense, AI assistant with approval, realtime collaboration + history, PDF export/PWA offline), How it works (crear viaje → invitar con código → planear juntos), hidden `#demo` video slot (renders only when `NEXT_PUBLIC_DEMO_VIDEO_URL` is set), FAQ, final CTA, footer. Mobile-first (375px).
- **L.3** SEO: `metadataBase` (`NEXT_PUBLIC_SITE_URL`), `openGraph`/`twitter` in `src/app/layout.tsx`, `src/app/opengraph-image.tsx` (`next/og`), `robots.ts`, `sitemap.ts`. Verify CSP in `next.config.ts` allows none of this to break.
- **L.V** Verify: build, screenshots desktop + 375px, signed-out sees landing, `?local=1` / signed-in go straight to app without landing flash.

### Phase H — HITL for the assistant
Design: stateless pause/resume. When the model emits any write/delete `tool_use`, the server runs the read tools of that turn, **does not run writes**, emits `{type:"confirm", token, actions:[{id, name, kind:"write"|"delete", summary}]}` then `done`. The `token` is an HMAC-signed, 15-min, `code`+`userId`-bound blob containing the transcript (`MessageParam[]` incl. thinking blocks) and the already-computed read results. The client resumes with `POST …/agent { messages, resume: { token, decisions: [{id, approve}] } }`: approved writes run via `executeTool` in order, rejected ones get `is_error` result "El usuario rechazó esta acción", then the loop continues normally (may pause again).
- **H.1** `src/server/agent/actions.ts`: `TOOL_KIND: Record<toolName, "read"|"write"|"delete">`; `describeAction(trip, name, input)` → Spanish summary (e.g. `Eliminar actividad "Cena" · Sáb 14`). Implemented as a pure function over the `RoomPayload` the loop loads once with `getTrip` (one round trip instead of a repo read per id); unknown ids give a "(no encontrada)" fallback. `src/server/agent/pending.ts`: `signPending` / `verifyPending` (node:crypto HMAC, `AGENT_RESUME_SECRET`, dev fallback, size cap). Tests.
- **H.2** Route `src/app/api/rooms/[code]/agent/route.ts`: extract the loop into `src/server/agent/loop.ts` (keep route <400 lines); pause/resume as above; new SSE frame `confirm`; body validation for `resume`. Remove the `AGENT_DESTRUCTIVE_TOOLS` gate (deletes now safe behind approval). Update `route.test.ts` (L54-62 destructive asserts → confirm-flow asserts) and `tools.test.ts`: write never executes without approval, reject path, tampered/expired token → 400, mixed read+write turn.
- Known limit (accepted): a resume token is not single-use, so re-sending the same approval within its 15 minutes would run the approved writes again. Only the trip owner holds the token; the client locks the card after the first decision (H.4). A single-use nonce would need a table; revisit if the agent opens to members.
- **H.3** Static text update of `src/server/agent/prompt.ts` (L28, L32) and tool descriptions: writes are shown to the user for approval — propose them directly, don't ask in text; batch related changes in one turn; on rejection don't retry, ask what to change. Prompt stays byte-stable after this step.
- **H.4** Client: extract the SSE logic from `src/components/agent/AgentPanel.tsx` into `src/hooks/useAgentChat.ts`; `AgentChatMessage` gains `pending?: { token; actions; status: "pending"|"approved"|"rejected"|"expired" }`. New `src/components/agent/AgentConfirmCard.tsx`: list of actions with per-item checkbox (shadcn `checkbox`), deletes styled destructive, buttons "Aprobar (n)" / "Rechazar todo"; locked after decision. Stop/abort marks pending as expired.
- **H.V** E2E with a real key (`HUMAN` if no key locally): create event → approve; delete task → reject; mixed batch partial approval; expired token message. `HUMAN`: set `AGENT_RESUME_SECRET` in Vercel.

### Phase I — Dynamic icons (events + tasks)
Rule: stored `icon` (nullable) wins; null = automatic from title; fallback = task category icon (`TASK_CATEGORIES`) / event default 📍. Title edits keep updating the emoji until the user overrides.
- **I.1** `src/constants/itemIcons.ts`: typed Record of ~40 entries `{ emoji, keywords }` (vuelo/aeropuerto ✈️, hotel/check-in 🏨, desayuno/almuerzo/cena/restaurante 🍽️, café ☕, playa 🏖️, museo 🏛️, tour 🗺️, parque 🎢, compras 🛍️, bar/fiesta 🍸, tren 🚆, bus 🚌, carro/uber/taxi 🚗, barco/crucero 🛳️, caminata 🥾, spa 💆, concierto 🎵, cumpleaños 🎂, …) + `ICON_CHOICES` for the picker. `src/utils/itemIcon.ts`: `suggestIcon(title)` (reuse `normalizeText` from `src/utils/ideas.ts`, word-boundary match, model on `src/constants/ideaTypes.ts`), `eventIcon(ev)`, `taskIcon(task)`. Tests.
- **I.2** Persistence (GUIDELINES §2 checklist): migration `supabase/migrations/020_item_icons.sql` — `icon text null` + `check (char_length(icon) <= 16)` on `trip_events`, `trip_tasks`; `create or replace public.get_trip` copied from 019 adding `'icon'`. `src/types/database.ts`, `src/server/domain/eventRows.ts` + `taskRows.ts` (accept string ≤16 or null to reset), `src/utils/tripRows.ts` (`optStr(r.icon)`), `icon?: string` in `CalendarEvent`/`Task`, hooks `useItinerary` (`event.create` args list L76) and `useTasks` send it. `HUMAN`: apply 020 **before** deploying the code.
- **I.3** Display: `eventIcon` in `calendar/EventBlock.tsx`, `itinerary/DayAgenda.tsx`, `itinerary/ItineraryAgenda.tsx`, `home/TodayCard.tsx`, `itinerary/ActivityDetail.tsx`; `taskIcon` replaces `c.icon` in `calendar/TaskBlock.tsx`, `tasks/TasksView.tsx`, `home/HomeView.tsx`.
- **I.4** `src/components/IconPicker.tsx`: grid of `ICON_CHOICES`, suggested emoji first, "Automático" resets to null; popover on desktop, `bottom-sheet` on mobile. Wired into `editor/EventEditor.tsx` and the task editor in `TasksView.tsx` (next to category picker L271-277), following dirty + ✓/✕.
- **I.V** Old trip (no icons) renders auto emojis; override persists after reload and syncs to a second tab.

### Phase S — Save feedback
- **S.1** `src/lib/opQueue.ts`: track `lastSavedAt` in `emitState`; `send` returns `Promise<"ok"|"conflict"|"failed">` resolved on ack (existing callers ignore it). `useTripOps` exposes `lastSavedAt`. Tests in the opQueue test file.
- **S.2** Generalize `src/components/Toast.tsx` into `Snackbar` + `useSnackbar` (`{ message, action? }`, 4 s, one at a time, `aria-live="polite"`); drag-undo toast migrates to it. App-level `notify` passed down. After ack of explicit commits show: "Evento creado/guardado/eliminado", "Tarea creada/completada/eliminada", "Gasto guardado". Not on drag (own toast) or per keystroke. "Deshacer" on event/task delete (re-create from the optimistic snapshot via the existing create op). Failures keep using `SyncNotice`. Note: overlaps old plan step 6.2 (per-change undo) — keep this client-only and minimal.
- **S.3** `src/components/AppHeader.tsx` (`SYNC` map L31-36): short label visible on mobile; after "Guardado" settles, show "Guardado · hace X" via `src/hooks/useNow.ts`.
- **S.V** Verify on 375px and desktop: edit event → "Guardando…" → snackbar "Evento guardado"; delete → Deshacer restores it; offline → error state.

### Phase F — Wrap-up
- **F.1** Docs: `GUIDELINES.md` (entry gate, HITL flow, icon field, snackbar usage), `CLAUDE.md` agent bullet (confirm frame), `.env.example` (`AGENT_RESUME_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEMO_VIDEO_URL`). Draft PR description in the progress file. `HUMAN`: apply migration 020, set env vars, push, open PR.

Dependencies: phases are independent except I.2→I.3→I.4 and H.1→H.2→H.4; S.2 depends on S.1. Order run by the loop: L → H → I → S → F.

## Verification (overall)

Every step: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npx next build`. `.V` steps exercise the real UI in the browser (dev server, `?local=1` where possible) and record screenshots/results in the progress log. Old trips must keep working at every step (optional fields, read-time defaults).
