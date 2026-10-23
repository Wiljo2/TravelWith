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
- [ ] 4. **Onboarding 1 — welcome for a first-time creator** (`first-run-onboarding.md` step 1).
- [ ] 5. **Onboarding 2 — short creation wizard** (step 2).
- [ ] 6. **Onboarding 3 — "¿Cómo quieres empezar?"** invite / TikTok / AI (step 3).
- [ ] 7. **Onboarding 4 — invite link, WhatsApp, visible "Invitar"** (step 4).
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

## Log

- 2026-10-22 — Item 2 done: `?local=new` / `npm run local:new` / second link under the sign-in
  card seeds an empty "Mi viaje" (5 days starting in 30 days, no people). Checked in the browser.
- 2026-10-22 — Item 1 code done (`useAuth`, `auth/EmailAuthForm`, `auth/SignInOptions`,
  `auth/PasswordRecoveryDialog`, FAQ copy). Sign-in card and sign-up form checked in the browser;
  a real sign-up was not run (dev shares the production project). Waiting on owner actions.
- 2026-10-22 — Item 3 done: walked landing → local sign-in (random email/password) → empty
  "Mis viajes" → "Nuevo viaje" (Viaje a Cartagena, Dec 10–13) → trip with those dates, in the browser.
