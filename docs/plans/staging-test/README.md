# Two-account browser test on staging

Phase 3 exit criteria of `docs/plans/relational-broadcast.md`: two accounts editing the same trip see each other's changes live, and conflicts on the same item show a notice. Runs against the staging project `travelwith-staging` (`ddxxpcrgudllkgkyqqzw`), never production.

## Setup (once)

1. Paste the staging `service_role` key into `.env.staging.local` (Dashboard → Settings → API Keys → Legacy API keys → `service_role` → Reveal). Never commit it (`*.local` is gitignored).
2. Staging already has migrations 001–019 and the trip `NVHPCI` (copy of the production trip) with two members: test user A (owner) and test user B (member), both created for the 0.1 spike.

## Run

```
node docs/plans/staging-test/dev.mjs          # app on http://localhost:3001 using staging
node docs/plans/staging-test/login.mjs a      # writes session-a.js.local
node docs/plans/staging-test/login.mjs b      # writes session-b.js.local
```

The app only offers Google sign-in, so each snippet stores a session for a test user: open `http://localhost:3001` in the browser, paste the snippet in the DevTools console (it reloads the page). Use two browser profiles, or a normal and a private window, to be A and B at once. Tokens last about an hour; run `login.mjs` again for a fresh snippet.

## Checklist

- [ ] A and B both open the trip `NVHPCI`; the header shows it connected and both appear as travelers.
- [ ] A edits an activity (title, hours, drag to another day): B sees it without reloading.
- [ ] A and B edit different activities at the same time: both changes survive.
- [ ] A and B edit the same activity: the second one gets the "Otro miembro cambió este elemento" notice and shows the other version.
- [ ] Budget: add and edit an expense, change the exchange rate: B sees them.
- [ ] Tasks: create, toggle, add an option, choose it (creates the activity and the expense).
- [ ] Ideas: A adds one and B votes it; Documents: add a Drive link; Map: open the tab, places appear (locating needs `ANTHROPIC_API_KEY`).
- [ ] Reload B: everything A did is still there.
- [ ] Non-member: a third account (or A after leaving) gets 403 on `GET /api/rooms/NVHPCI` and receives nothing on the channel.
- [ ] `MAINTENANCE_MODE=on` in `.env.staging.local`: edits show the banner and are kept; with it off they are saved.
- [ ] Owner-only: B does not see "Restablecer itinerario"; A does.

Anything that fails: note it and tell the loop, it is added to the progress file as a blocker.
