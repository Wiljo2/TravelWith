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
- [ ] 6. **Onboarding 3 — "¿Cómo quieres empezar?"** invite / TikTok / AI (step 3).
- [x] 7. **Onboarding 4 — invite link, WhatsApp, visible "Invitar"** (step 4).
- [ ] 8. **Onboarding 5 — "Primeros pasos" card on Inicio** (step 5).
- [ ] 9. **Onboarding 6 — teaching empty states** (step 6).
- [ ] 10. **Group voting on dates/destination via "Por decidir"** (step 7; design note first).
- [ ] 11. **Welcome for someone joining by invitation** (step 8).

## Owner actions

For item 1 (Supabase dashboard → Authentication):
- [ ] **Sign In / Providers → Email**: enabled. Decide on "Confirm email" (on = the user must open the
      link before signing in; the UI handles both).
- [ ] **Emails → SMTP**: set a custom SMTP (e.g. Resend). Supabase's built-in sender only delivers to
      the project's team members and is rate limited, so real users would never get the
      confirmation or reset email.
- [ ] **URL Configuration → Redirect URLs**: includes `http://localhost:3000/**` and the production
      origin, otherwise confirmation/reset links fall back to the Site URL.
- [ ] **Apple** (optional): Apple Developer Program, a Services ID + Sign in with Apple key, then
      **Providers → Apple** in Supabase; finally `NEXT_PUBLIC_AUTH_APPLE=1` in `.env.local` / Vercel.
- [ ] Verify end to end: create an account, confirm by email, sign in, sign out, reset the password.

For item 7 (needs a real database — staging or production with a test trip):
- [ ] Open `/?join=<CODE of a test trip>` signed in with a second account → it joins and opens the trip.
- [ ] Same link signed out → banner → sign in (Google and email) → joins automatically.
- [ ] `/?join=` with a made-up code → "No encontramos ese viaje. Pide un enlace nuevo."
- [ ] "Enviar por WhatsApp" on a phone opens WhatsApp with the message and link.

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
