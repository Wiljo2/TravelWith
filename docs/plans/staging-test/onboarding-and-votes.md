# Two-account walk on staging: invites, votes, undated trips

Checks for checklist items 7, 6, 10 and 11 that need a real database and two people. Runs against the
staging project `travelwith-staging` (`ddxxpcrgudllkgkyqqzw`), never production. Staging has migrations
024 and 027 since 2026-10-23.

## Setup

1. `node docs/plans/staging-test/dev.mjs` → app on http://localhost:3001 using staging.
2. Two browser profiles (or a normal and a private window): **A** and **B**.
3. Sign in as the spike test users. The app now has email + password sign-in, so A and B can use the
   login form directly with the credentials in `docs/plans/spike/.env.spike.local` (A) and
   `.env.spike-b.local` (B). The `login.mjs` snippets from `README.md` still work too.

## Cases

| # | Who | Do | Expect |
|---|---|---|---|
| 1 | A | Open trip `NVHPCI`, Inicio and every tab | Loads as before; 0 votes anywhere |
| 2 | A | "Crear mi primer viaje" / "Nuevo viaje" → wizard with **"lo votamos"** for destination and dates, friends ×4, nothing booked → Crear | StartChoices says why to invite; Inicio shows "¿Cuándo viajamos?" and "¿A dónde vamos?"; header "Fechas por decidir"; Itinerario "Primero decidamos las fechas" |
| 3 | A | "Invitar a mi grupo" → copy the link | Link is `http://localhost:3001/?join=<CODE>` |
| 4 | B | Open the link **signed out** | Banner "Te invitaron a un viaje…" → sign in → joins and opens the trip → "¡Bienvenido a <trip>! 👋" with the two votes under "Lo que te espera" |
| 5 | B | Reload, then open the trip again from "Mis viajes" | No welcome the second time |
| 6 | A + B | Each proposes a date range on Inicio; both vote ✋ on the same option at the same moment | Both votes stay; each screen shows the other's vote live; history "… votó en la opción …" |
| 7 | B | Try to close the vote | No "Elegir" for a member; "El creador del viaje elige cuando estén listos" |
| 8 | A | "Elegir" on the winner → confirm | Header shows the dates, Itinerario gets the days; **B sees the days and dates appear live** |
| 9 | A | Propose and choose a destination | Header destination updates on both screens |
| 10 | A | On the dated `NVHPCI` trip, "Votar fechas" → propose → Elegir | Dialog warns "Se borrarán N actividades"; **cancel** (don't wipe the copy of the real trip) |
| 11 | A | `/?join=ZZZZZZZZZZ` | "No encontramos ese viaje. Pide un enlace nuevo." |
| 12 | A (owner) | "Contarle a la IA" right after creating a trip (needs `ANTHROPIC_API_KEY` in `.env.staging.local`) | Assistant opens with the drafted request, not sent |

Phone-only (real devices): "Enviar por WhatsApp" opens WhatsApp with the message; long-press drag in
Agenda and Horas (checklist item 13).

Record pass/fail per case in the Log of `docs/plans/test-checklist.md`.
