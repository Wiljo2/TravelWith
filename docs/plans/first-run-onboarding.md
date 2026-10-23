# First-run onboarding, group voting and invited welcome — general plan

## Context

Testing the app as a brand-new user (the `?local=new` sandbox) showed that after signing in the
creator lands on an empty "Mis viajes" and a bare form (name, destination, dates), with no guidance
on how to build the trip. Inviting the group — the core of a group app — is hidden behind
"Copiar código" in the ⋯ menu. A competitor review (Wanderlog, Polarsteps, Mindtrip, Lambus,
Troupe, TripIt) showed common patterns: only destination + dates required, invite early (link/PIN,
inside creation), a "first steps" checklist with progress, start from something the user already
has (TikTok, bookings), group voting (Troupe), and avoid long quizzes (Wanderlog: ~6 min, 42 steps).

The owner chose: offer all three starting hooks (invite, paste a TikTok/reel, describe to the AI)
and support group voting. Open design points follow the recommendations already discussed:
date options are 2–3 proposed ranges, anyone in the trip can add options, the **owner closes** the
vote, and an undated trip still works (Ideas/Gastos/Pendientes) while the itinerary says
"Primero decidamos las fechas".

Outcome: a creator goes from sign-in to a trip with their group invited in about a minute; an
invited person gets a welcome that tells them what to do; groups can decide dates/destination
together.

## How the loop works

- Source of truth: copy this plan to `docs/plans/first-run-onboarding.md` and add one checklist
  item per step below to `docs/plans/test-checklist.md` (items 4+). Work top to bottom.
- Each iteration: take the first unchecked step → if it has an open design question, write the
  decision in the plan doc first (short, with the reason) → delegate the implementation to a
  general-purpose subagent with the step spec, the repo rules (CLAUDE.md, GUIDELINES.md §2–4) and
  the files named here → review the diff → verify (below) → log in the checklist → commit on branch
  `feat/first-run-onboarding` (no push, no PR, no production migration without asking).
- Subagents don't use browser tools (one hung on them); the orchestrator does the browser walk.
- Every new flow must work in the local sandbox (`?local=new`, in memory) so it can be checked in
  the browser without touching production (local dev shares the production database).
- Blocked on an owner action (apply a migration, Supabase setting) → write exact steps under
  "Owner actions" and continue with the next unblocked step. A decision not covered here → ask.

## Steps

### 1. Welcome for a first-time creator (gate)
- When the signed-in user has no trips, replace "Aún no tienes viajes" with a welcome:
  greeting by first name, primary "Crear mi primer viaje", secondary "Tengo un código de invitación".
- Split `src/components/RoomGate.tsx` (327 lines) into `components/gate/` pieces
  (`WelcomeFirstTrip`, `TripList`, `JoinByCode`, `CreateTripWizard`) to stay under ~400 lines.

### 2. Short creation wizard (replaces the flat form)
- One question per screen, skippable where optional, max 4:
  1. ¿A dónde vas? (destination)
  2. ¿Cuándo? (start/end) — "Aún no sabemos, lo votamos" appears once step 7 lands
  3. ¿Con quién? solo / pareja / amigos / familia + how many → placeholder travelers
     ("Viajero 2…N") via the existing `traveler.add` op (`src/hooks/useTripInfo.ts`)
  4. ¿Qué ya tienen resuelto? chips (vuelos, alojamiento, nada) → starter tasks
     ("Reservar vuelos", "Reservar alojamiento") via the existing task ops (`useTasks`)
- Name suggested from answers ("Cartagena con amigos · Dic 2026"), editable.
- Creation still goes through `POST /api/rooms` (`src/app/api/rooms/route.ts`). **Decision
  (2026-10-22):** seeding happens server-side in that route (optional `travelers` and `tasks`), not
  as client ops after creation — it is atomic with creation, reuses the room cleanup on failure, and
  matches how the route already calls `joinRoom` / `resetItinerary`. Sandbox: `RoomGate` sandbox branch + `freshRoomPayload`
  (`src/data/freshRoom.ts`) accept the travelers and tasks.

### 3. "¿Cómo quieres empezar?" (right after creation)
**Order (2026-10-22):** built after step 4, because its invite card opens step 4's share sheet.
- Three cards + "Saltar": 👥 Invitar a mi grupo · 🎬 Pegar un TikTok o reel · ✨ Contarle a la IA.
  The invite card is highlighted when dates/destination are left to a vote.
- TikTok/reel → Ideas tab with the paste field focused; reuse `useSharedLink`
  (`src/hooks/useSharedLink.ts`) / `AddIdeaForm` instead of new plumbing.
- AI → open the assistant with a prefilled draft built from the wizard answers; add an optional
  `initialDraft` prop to `src/components/agent/AgentPanel.tsx`. Hidden in local mode (no agent).
- Cards not chosen become steps in "Primeros pasos" (step 5).
- Built: the trigger is in memory (`useStartChoices` + RoomGate `onCreated`), so a reload doesn't
  bring the choices back; the AI draft comes from the wizard's `NewTrip`.

### 4. Invite: link, WhatsApp and visible entry point
- Share sheet: link `/?join=<CODE>` (`code` is taken by the PKCE OAuth redirect), copy code,
  WhatsApp (`https://wa.me/?text=`), `navigator.share` when available.
- `?join=` enters the app (`src/components/landing/entry.ts` + `entryScript.ts`), survives the
  sign-in redirect in sessionStorage (same pattern as `useSharedLink`), then joins through the
  existing `POST /api/rooms/[code]/members` and opens the trip (`src/hooks/useTripSession.ts`).
  **Decision (2026-10-22):** the pending join lives in localStorage with a 24 h expiry
  (`src/hooks/usePendingJoin.ts`), not sessionStorage, so email-confirmation links opened in a new
  tab still join; it takes priority over the auto-resume.
- Visible "Invitar" button in `src/components/AppHeader.tsx` (keep "Copiar código" in ⋯).

### 5. "Primeros pasos" card on Inicio
- Pure `src/utils/firstSteps.ts` derives steps from trip data: grupo invitado (members > 1),
  primera actividad, primera idea, primer gasto, primer documento → `n de 5` with a progress bar.
  Each step's button jumps to its tab. Unit tests.
- Shown in `src/components/home/HomeView.tsx` until done or dismissed (dismiss in localStorage per
  trip — per-viewer convenience, no new column).

### 6. Teaching empty states
- Audit each tab's empty state (Itinerario, Mapa, Ideas, Gastos, Pendientes, Documentos); each
  gets one sentence on what it's for and one action button. Reuse existing add actions.

### 7. Group voting (largest; design note first)
- **Reuse "Por decidir"** instead of a new poll domain: a vote is a task with `cat: "decidir"` and
  options (`TaskOption`, table `trip_task_options`). Add nullable columns via a new migration:
  `trip_task_options.votes text[]`, `start_date`, `end_date`; `trip_tasks.decides` (null |
  "dates" | "destination"). Follow the GUIDELINES §2 field checklist (types/database.ts, row
  validator in `src/server/domain/taskRows.ts`, op, `get_trip`, `utils/tripRows.ts`, hook
  `applyRow`). This also gives votes on activities/lodging options for free (Troupe's model).
- Votes toggle atomically in SQL (a function adding/removing the voter), not through the row
  version, so two people voting at once never conflict. Voter key mirrors idea votes
  (`Idea.votes` in `src/types/index.ts`, `toggleVote` in `src/hooks/useIdeas.ts`).
- Anyone can add options; only the owner closes: picking the winner applies it with the existing
  `trip.update` op (`src/server/ops/trip.ts`) and, for dates, generates the days
  (`itinerary.reset`, `src/server/ops/days.ts`), then marks the task done.
- **Undated trips** (riskiest part — write the design note first): `rooms.start_date/end_date`
  are already nullable, but `POST /api/rooms` (`validateTripInput`, `src/lib/validate.ts`) requires
  dates and `get_trip` omits `trip` without dates. Default proposal: make `TripInfo` dates optional
  behind a `hasDates(trip)` guard and let `tsc` list every consumer; new `get_trip` version via a
  new migration returns name/destination without dates. Itinerario shows "Primero decidamos las
  fechas" with a link to the vote; Inicio puts the vote at the center.
- Wizard step 2/1 gains "Aún no sabemos, lo votamos" → creates the trip undated + the vote task.
- Owner action: apply the migration to staging (`.env.staging.local`) and test there before prod.

### 8. Welcome for someone joining by invitation
- After joining (link or code), a one-time welcome sheet: "<nombre> te invitó a <viaje>", dates or
  "fechas por decidir", who's in, and what's waiting for them (open votes, "agrega tus ideas"),
  CTA "Ver el viaje". Seen-flag per trip in localStorage.

### Backlog (not in this loop)
- The assistant chat (`agentMessages` in `App.tsx`) is not cleared when switching trips, so one
  trip's chat shows in the next.
- "Ver un viaje de ejemplo" in production (read-only public demo; `mockRoom` is dev-only today).
- Editing trip dates of a trip that already has activities (no UI today; `trip.update` exists).
- Calendar-availability voting (Doodle style).

## Verification (every step)

- `npx tsc --noEmit`, `npm test`, `npx oxlint src` clean (no new warnings in touched files).
- Browser walk in the sandbox: `/?local=new` → landing → sign in with any email → the new flow;
  plus `/?local=1` (demo) and a signed-out `/?app=1` to check nothing regressed.
- Steps 4, 7, 8 (server/data): vitest for new ops/validators; migration applied by the owner to
  staging, then a real walk there; open a trip created before the change (GUIDELINES §2.7).
- Log result + date in `docs/plans/test-checklist.md`; screenshots only when the owner asks.
