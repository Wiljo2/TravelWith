# HITL manual check (step H.V)

Why manual: the assistant needs a real `ANTHROPIC_API_KEY`, a signed-in trip owner and a real trip, and every approved action writes to the database. Local mode (`?local=1`) does not run the assistant. Use a preview deployment or a dev server against a staging project, never a trip you care about.

## Setup
1. Set `AGENT_RESUME_SECRET` (any long random string, e.g. `openssl rand -base64 32`) in the environment you test (Vercel preview/production, or `.env.local`). Without it, production refuses to sign proposals.
2. Sign in as the owner of a test trip with at least two days, one event and one task.
3. Open the assistant panel (✨ Asistente).

## Cases
| # | Do | Expect |
|---|---|---|
| 1 | "Agrega una cena el segundo día a las 8pm" | "Revisando…" chips for reads, then a "Cambios propuestos (1)" card with `Crear actividad "Cena" · <día> · 8:00 pm–…`. Calendar unchanged. |
| 2 | Click "Aprobar (1)" | Card locks with "Aprobado"; a new assistant message runs "Creando actividad" and confirms; the event appears for every member live. |
| 3 | "Borra la tarea <X>" → "Rechazar todo" | Delete row shown in red with a trash icon; after rejecting, card says "Rechazado", the task still exists, and the assistant asks what to change instead (does not retry). |
| 4 | "Agrega un gasto de $50 por persona para la cena y mueve el museo a las 11" → uncheck one row → "Aprobar (1)" | Card shows 2 actions; status "Aprobados 1 de 2"; only the checked change is applied. |
| 5 | Ask for a change, wait > 15 minutes, then approve | Error "La propuesta expiró. Pide el cambio de nuevo." and the card shows "Expiró — pide el cambio de nuevo"; nothing is written. |
| 6 | Ask for a change, then type a new message without deciding | The old card becomes "Expiró"; the new answer does not apply the old proposal. |
| 7 | Ask for a change and press "■ Detener" while it streams | No changes applied; the chat stays usable. |
| 8 | Follow-up: "¿qué cambiaste?" after case 4 | The assistant knows which action was approved and which was rejected. |
| 9 | As a non-owner member | The assistant panel is not offered (owner-only beta, unchanged). |

## Record
Write the result of each case (pass / fail + note) in the log of `docs/plans/ux-wave-progress.md` and mark H.V `[x]`.
