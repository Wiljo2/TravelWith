# Test-driven checklist

Items the owner adds while testing the app locally. Work them top to bottom; mark `[x]` only when
`npx tsc --noEmit` and `npm test` pass and the change was checked in the running app. Anything that
needs a dashboard or account action outside the repo goes under "Owner actions" with the exact steps.

## Items

- [ ] 1. **Accounts without Google** — sign up / sign in with email + password (name, email,
      password), password reset, and "Continuar con Apple" (hidden until Apple is configured).
- [x] 2. **"Brand-new user" local mode** — besides the demo-data local mode, a local mode that
      opens an empty trip exactly as a first-time user would see it (no activities, expenses,
      tasks, people or ideas). `?local=new`, `npm run local:new`.
- [x] 3. **"Brand-new user" mode follows the real first-run flow** (replaces where item 2 lands).
      `?local=new` (or the "viaje nuevo vacío" link) shows the landing → CTA → sign-in that accepts
      any email/password, Google or Apple (local only, `data/localSandbox.ts`) → empty "Mis viajes"
      → "Nuevo viaje" form → the trip built locally from the form. No Supabase, nothing saved.
      "Unirse con código" says there are no other people's trips locally; the created trip shows
      in "Mis viajes". Known limit: leaving the trip and re-entering starts it empty again.
      The sandbox lasts for the browser tab; open `?local=new` again to start over.
- [x] 4. **Onboarding 1 — welcome for a first-time creator** (`first-run-onboarding.md` step 1).
- [x] 5. **Onboarding 2 — short creation wizard** (step 2).
- [x] 6. **Onboarding 3 — "¿Cómo quieres empezar?"** invite / TikTok / AI (step 3).
- [x] 7. **Onboarding 4 — invite link, WhatsApp, visible "Invitar"** (step 4).
- [x] 8. **Onboarding 5 — "Primeros pasos" card on Inicio** (step 5).
- [x] 9. **Onboarding 6 — teaching empty states** (step 6).
- [x] 10. **Group voting on dates/destination via "Por decidir"** (step 7; design note first).
- [x] 11. **Welcome for someone joining by invitation** (step 8).
- [x] 12. **Agenda in compact day cards + "Mes" view** (desktop; the phone Agenda stays as it is).
      Cards: 2–3 columns on desktop; each day shows its label/subtitle and one line per activity
      (time · emoji · title), the first 4–5 then "+N más", which expands that card in place;
      "+ Actividad" per card; tapping an activity opens its detail as today.
      "Mes" as a third toggle next to Agenda / Horas, shown only when the trip doesn't fit in one
      Mon–Sun week; it renders only the weeks the trip touches (Mon–Sun rows, days outside the trip
      greyed), each day with its first activity titles on desktop / category dots on phone and a
      count, trip/day spans as bars across days; tapping a day opens it in Agenda. View only (no
      drag) in v1. Default view stays Agenda.
- [x] 13. **Move activities on the phone with long-press + drag.**
      **Bug (Horas, phone):** the owner couldn't move an activity at all. The long-press drag exists
      (`src/hooks/useTouchDrag.ts`: `HOLD_MS` 350, `MOVE_TOLERANCE` 10 px, vibrate) but fails on a
      real phone. Hypotheses to check first: the 10 px tolerance cancels the hold with normal finger
      jitter; no `touch-action` / `-webkit-touch-callout: none` / `user-select: none` on the blocks,
      so the browser scrolls or opens its long-press menu first; the grid's day-swipe handler
      (`CalendarGrid` `onTouchStart={onSwipeStart}`) competes; `useIsTouch` misdetects and falls back
      to HTML5 drag. Reproduce with Playwright touch emulation (iPhone/Android device descriptors,
      `hasTouch`) and, if possible, a real phone; fix the cause, not just the timing.
      **New (Agenda, phone) — option A:** long-press (same feel: ~350 ms + vibrate) lifts the
      activity, drag it onto another day card (the list auto-scrolls near the edges), drop to move
      it to that day keeping its hours, or at the next free hour if it collides (decided 2026-10-23); a short tap
      still opens the detail; scrolling the list with a quick swipe must keep working.

## Owner actions

For item 1 (Supabase dashboard → Authentication):
- [x] **Sign In / Providers → Email**: enabled. Decide on "Confirm email" (on = the user must open the
      link before signing in; the UI handles both). Checked 2026-10-23: enabled, sign-ups allowed,
      "Confirm email" on, in both projects.
- [ ] **Emails → SMTP**: set a custom SMTP (e.g. Resend). Supabase's built-in sender only delivers to
      the project's team members and is rate limited, so real users would never get the
      confirmation or reset email.
- [x] **URL Configuration → Redirect URLs**: includes `http://localhost:3000/**` and the production
      origin, otherwise confirmation/reset links fall back to the Site URL. Done 2026-10-23:
      production + `https://travelwith-five.vercel.app/**`, `http://localhost:3000/**`; staging +
      `http://localhost:3001/**`, `http://localhost:3000/**`.
- [ ] **Apple** (optional): Apple Developer Program, a Services ID + Sign in with Apple key, then
      **Providers → Apple** in Supabase; finally `NEXT_PUBLIC_AUTH_APPLE=1` in `.env.local` / Vercel.
- [ ] Verify end to end: create an account, confirm by email, sign in, sign out, reset the password.

For item 7 (needs a real database — staging or production with a test trip):
- [ ] Open `/?join=<CODE of a test trip>` signed in with a second account → it joins and opens the trip.
- [ ] Same link signed out → banner → sign in (Google and email) → joins automatically.
- [ ] `/?join=` with a made-up code → "No encontramos ese viaje. Pide un enlace nuevo."
- [ ] "Enviar por WhatsApp" on a phone opens WhatsApp with the message and link.
- [ ] Item 6 on a real trip you own: "Contarle a la IA" opens the assistant (desktop panel and phone
      sheet) with the draft filled in, not sent.

For item 10 (group voting) — migration `supabase/migrations/027_group_votes.sql`:
- [x] Apply 027 to **staging** (never production first; not during the trip Nov 26 – Dec 4). This
      branch must not be deployed anywhere before 027 is applied there: votes would answer 500.
      Done 2026-10-23 with 024 (staging was missing it too).
- [ ] Apply 024 and 027 to **production** right before deploying this branch.
- [ ] ~~Turn on leaked password protection~~ — not available: it needs the Supabase Pro plan (the org
      is on Free). Revisit if the plan changes.
- [ ] **Deploy blocker:** production has "Confirm email" on and **no custom SMTP**, so people outside
      the Supabase team never get the confirmation email and can't finish an email sign-up. Set up
      SMTP (e.g. Resend) before deploying email sign-up.
- [ ] Optional: raise "Minimum password length" from 6 to 8 in both projects to match the app
      (`MIN_PASSWORD_LENGTH` = 8); today only the client enforces 8.
- [ ] Run the two-account walk: `docs/plans/staging-test/onboarding-and-votes.md`.
- [ ] On staging, two accounts vote on the same "Por decidir" option at the same time → both votes
      stay and show live on the other screen; history says "… votó en la opción …".
- [ ] A trip created before the change loads and edits as before, with 0 votes.
- [ ] Create a trip with "lo votamos" for dates and destination → undated trip with both votes;
      propose dates, close as owner → days appear for every member live.

For item 13 (phone drag) — needs real phones:
- [ ] On an iPhone and an Android phone, in Agenda and in Horas: hold an activity ~half a second and
      drag it to another day; then a quick swipe that starts on an activity must scroll, not drag.

For item 11 (welcome for invited people) — needs two accounts:
- [ ] Account A creates a trip; account B opens `/?join=CODE` → after joining, "¡Bienvenido a
      <viaje>! 👋" with dates, who's in and "Lo que te espera"; reopening the trip from the list
      doesn't show it again.
- [ ] 7c on staging, dated trip with activities, owner A and member B: A taps "🗳️ Votar fechas" in
      Pendientes; both propose ranges on Inicio and vote with ✋ → counts live on both screens. B
      sees no "Elegir" and no × on the vote; a forced `task.closeVote` from B answers 403. A taps
      "Elegir" → dialog says "Se borrarán N actividades" → confirm → both see the new dates in the
      header and the rebuilt days live; the vote moves to Completadas with "Elegida".
- [ ] Same with "🗳️ Votar destino": closing updates the header destination for both, and the Ideas
      places follow it.
- [ ] While A's dialog is open, B adds an activity on a trip that had none → A's close is refused
      (sync notice, trip reloads) instead of wiping it silently.

## Log

- 2026-10-22 — Item 2 done: `?local=new` / `npm run local:new` / second link under the sign-in
  card seeds an empty "Mi viaje" (5 days starting in 30 days, no people). Checked in the browser.
- 2026-10-22 — Item 1 code done (`useAuth`, `auth/EmailAuthForm`, `auth/SignInOptions`,
  `auth/PasswordRecoveryDialog`, FAQ copy). Sign-in card and sign-up form checked in the browser;
  a real sign-up was not run (dev shares the production project). Waiting on owner actions.
- 2026-10-22 — Item 3 done: walked landing → local sign-in (random email/password) → empty
  "Mis viajes" → "Nuevo viaje" (Viaje a Cartagena, Dec 10–13) → trip with those dates, in the browser.
- 2026-10-22 — Item 4 done: `RoomGate` split into `components/gate/` (TripList, JoinByCode,
  CreateTripForm, WelcomeFirstTrip) + `utils/userName.ts`; zero trips shows "Hola, <nombre> 👋" with
  "Crear mi primer viaje" / "Tengo un código de invitación"; list errors now show without a form open.
  Walked in the sandbox: welcome → create → leave → list → remove → welcome again.
- 2026-10-22 — Item 5 done: `CreateTripWizard` (destination → dates → companions + count → what's
  resolved → confirm with suggested name); `POST /api/rooms` seeds placeholder travelers and starter
  tasks (`server/domain/seedRows.ts`, `tableRepo.insertMany`); double-click guard on "Crear viaje".
  Walked in the sandbox: Cartagena, Dec 4–7, friends ×4, flights resolved → "Cartagena con amigos ·
  Dic 2026" with "Reservar alojamiento" in Por decidir. Sandbox-only difference: Inicio counts 3
  travelers (the sandbox user is not a room member; in production the creator is, so 4).
- 2026-10-22 — Item 7 done: "Invitar" in the trip header opens `InviteSheet` (link `/?join=CODE`,
  WhatsApp, share, copy code); `?join=` enters the app, is kept 24 h in localStorage across sign-in
  (`usePendingJoin`) and joins through `lib/joinTrip.ts` before auto-resume. Walked in the sandbox:
  sheet in the demo trip, banner when signed out, sandbox message after sign-in. A real join needs a
  database → owner checks above.
- 2026-10-22 — Item 6 done: after creating a trip, `StartChoices` ("Tu viaje está listo 🎉 ·
  ¿Cómo quieres empezar?"): Invitar (opens `InviteSheet`), Pegar un TikTok o reel (→ Ideas with the
  form prefilled via `useSharedLink.share`), Contarle a la IA (assistant with a prefilled draft,
  owner only, hidden in local mode). Trigger is in memory (`useStartChoices`, RoomGate `onCreated`).
  Walked in the sandbox: choices appear after creating; reel link lands on Ideas prefilled. Fixed on
  the way: a long link pushed "Nueva idea" out of its dialog (`wrap-anywhere`).
- 2026-10-22 — Item 8 done: "Primeros pasos" card at the top of Inicio (`FirstStepsCard`,
  `useFirstSteps`, pure `utils/firstSteps.ts`): invite / first activity / idea / expense / document,
  "n de 5", each pending step jumps to its tab (invite opens the sheet, documents scrolls to the panel).
  Per trip and device: dismissed stays dismissed; a trip that already has 2+ steps done when first seen
  never shows it (lowered from 3 after the demo trip — activities + expenses — still showed it).
  Walked in the sandbox: new trip shows 0 de 5, "Gastos" jumps to Gastos, demo trip shows no card.
- 2026-10-22 — Item 9 done: empty states that teach — Itinerario intro card ("Arma el día a día" +
  "Agregar la primera actividad" → new-activity window at the first day 9:00, agenda and hours views),
  Mapa card with "Ir al itinerario" (hidden offline so the map's own error shows), Gastos explains
  global vs per-day and group vs per-person, Pendientes empty state with "Escribir la primera tarea".
  Ideas and Documentos already explained themselves. Walked all four tabs in the sandbox.
- 2026-10-22 — Item 10, 7a (groundwork) done: design note `docs/plans/group-voting.md` (+ decisions);
  `ItineraryTab` out of `App.tsx` (400 → 340), `TaskRow` out of `TasksView` (345 → 145),
  `DateRangeFields`; `TripInfo` dates optional behind `hasDates` with undated fallbacks ("Fechas por
  decidir"); POST /api/rooms still requires dates. Regression walk on the demo trip: Inicio, Agenda,
  Horas, Pendientes (task detail), Gastos unchanged.
- 2026-10-22 — Item 10, 7b (votes on "Por decidir" options) done in code: migration 027 written,
  not applied (columns for 7c/7d, `set_task_option_vote`, `close_task_vote`, `get_trip` with a static
  test that no key is lost); op `taskOption.vote` (voter = signed-in user, no version guard); ✋ with
  count, "Tú, Ana y 2 más", "Más votada", confirm when removing a voted option; Inicio "2 opciones ·
  ✋ 1 voto". Walked in the demo trip (local, in memory): vote, unvote, revote, Inicio count. Real
  voting needs 027 on staging → owner actions above.
- 2026-10-23 — Item 10, 7c (date / destination votes on a dated trip) done in code, needs 027 on
  staging: `task.create` with `decides` (one open vote per kind, forced "decidir" backlog), option
  dates (≤ 60 days, required on dates votes; destinations ≤ 80 chars; ≤ 5 options; closed votes
  frozen), `task.closeVote` (owner only) → `close_task_vote` with the replace confirm; members get
  403 marking done or deleting a vote; `task.chooseOption` refuses votes. UI: Pendientes "🗳️ Votar
  fechas / destino", vote cards on Inicio and Pendientes, `CloseVoteDialog`. Assistant read views
  wait for `feature/agent-tools`. Sandbox walk (in memory) not done yet (no browser in this session).
- 2026-10-23 — Item 10, 7c (date/destination votes on a dated trip) done in code: "Votar fechas" /
  "Votar destino" in Pendientes, `VoteCard` on Inicio + "Votaciones" in Pendientes, proposals (≤ 5),
  owner-only "Elegir" → `CloseVoteDialog` → `task.closeVote` (`close_task_vote`; refuses to wipe
  activities unless the owner confirms "Elegir y borrar N actividades"). No 028 needed. Walked in the
  demo trip: start dates vote → propose Mar 10–13 → vote → Elegir (12 activities warning) → header
  "Mar 10 – 13, 2027", 4 new empty days, vote in Completadas as "Elegida". Assistant read views wait
  for `feature/agent-tools`.
- 2026-10-23 — Item 10, 7d (undated trips + wizard) done in code: POST /api/rooms takes both dates or
  neither and seeds `decides` vote tasks; wizard "🗳️ Aún no sabemos, lo votamos" for destination and
  dates; `UndatedHero` on Inicio, `DatesPending` on Itinerario; StartChoices explains why to invite.
  No 028. tsc + 713 tests pass. **Browser walk pending** (the browser extension disconnected): walk
  `?local=new` with both "lo votamos" → votes on Inicio → propose + close → days appear.
- 2026-10-23 — Item 11 done in code: `JoinWelcome` (Dialog / BottomSheet) after a first join by link or
  code — not for the creator, not when opening a known trip, not on reload; "Lo que te espera" (open
  votes, ideas, itinerary) from pure `utils/joinWelcome.ts`. Inviter name not shown (the roster has no
  roles). Dev-only preview: `/?local=1&welcome`. tsc + 727 tests pass. **Browser walk pending** (the
  browser extension disconnected).
- 2026-10-23 — Items 10 (7d) and 11 walked with Playwright (system Chrome, headless; the Chrome
  extension was unavailable in the session), desktop 1440×900 and phone 390×844, 24/24 checks: wizard
  with both "lo votamos" → confirm "Destino: lo votan / Fechas: las votan" → StartChoices explains why
  to invite → undated Inicio with both votes → Itinerario "Primero decidamos las fechas" → propose two
  ranges → vote → owner closes (no activity warning) → header dates + days; `/?local=1&welcome` sheet →
  "Agrega tus ideas" closes it. Real-database checks stay under Owner actions.
- 2026-10-23 — Item 12 done: desktop Agenda in compact cards (`AgendaCard`; 1–3 columns by the main
  column's width via container queries, first 5 lines + "+N más" / "Ver menos"); "Mes" (`MonthView`,
  `utils/tripWeeks.ts`) only when the trip crosses a Mon–Sun week, showing just the weeks it touches,
  titles on wide / dots on narrow, span bars across days; tapping a day opens it in Agenda. Phone
  Agenda unchanged. Walked: demo trip in Chrome (3 columns, no "Mes" for a one-week trip; after moving
  it to Mar 4–13, "Mes" with 2 week rows, tap Mar 11 → Agenda at that day) and a phone at 360 px with
  Playwright (toggles fit, no overflow). Fixed on the way: "10:00 am" wrapped in the card.
- 2026-10-23 — Item 13 done: root causes in Horas — the non-passive touchmove listener was added during
  touchstart (iOS Safari then ignores preventDefault and scrolls; reasoned, not reproducible in
  Chromium), the day swipe flipped the view after a sideways drop (reproduced, fixed), and Android
  scrolling could start inside the hold; `useTouchDrag` now registers the listener on mount and is
  shared. Phone Agenda: long-press lifts a ghost, target card highlights, auto-scroll, drop moves the
  activity keeping its hours or at the next free hour (`moveStartHour`). Same-spot drops are no-ops.
  Walked with Playwright touch emulation (iPhone 390×844, Pixel 412×915), 13 scenarios each, all pass
  (re-run by the orchestrator). Real-device check → owner actions above.
- 2026-10-23 — Staging (`ddxxpcrgudllkgkyqqzw`, via the Supabase MCP after confirming the project URL):
  applied 024 and 027; verified the 4 new columns, 3 checks, `set_task_option_vote` / `close_task_vote`
  / `get_trip` executable only by `service_role`, `app_errors` with RLS, and `get_trip('NVHPCI')` intact
  (9 days, 9 tasks, 6 expenses, dates and destination). Advisors: nothing new from these migrations;
  leaked password protection is off (owner action above). Two-account walk written in
  `docs/plans/staging-test/onboarding-and-votes.md`.
