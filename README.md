# TravelWith

Collaborative group-trip planner: a day-by-day calendar with drag and drop, a shared budget with per-person splits, tasks and decisions, and an AI assistant, synced live between the members of a trip.

Architecture, rules and conventions live in [GUIDELINES.md](GUIDELINES.md); working rules for contributors and agents are in [CLAUDE.md](CLAUDE.md). UI copy is Spanish.

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Data | Supabase: Postgres (one JSONB payload per trip), Auth (Google), Realtime |
| AI assistant | Claude via `@anthropic-ai/sdk` (server-side tool loop) |
| Tests / lint | Vitest, oxlint |
| Deploy | Vercel |

## Run locally

```bash
npm install
npm run dev
```

### Local mode (no account, no database)

Open `http://localhost:3000/?local=1` (or the "Modo local" link on the entry screen). It boots with the fictional demo trip in `src/data/mockRoom.ts` and saves nothing. Development builds only.

### Against a Supabase project

1. Copy `.env.example` to `.env.local` and fill in the values from Supabase (Settings → API) and the Anthropic console.
2. Run the SQL files in `supabase/migrations/` in order.
3. For Google sign-in to return to localhost, add `http://localhost:3000/**` to Supabase → Authentication → URL Configuration → Redirect URLs.

`SUPABASE_SERVICE_ROLE_KEY` is required: route handlers use it and enforce trip membership themselves (production refuses requests without it). Browser clients only get rows of trips they belong to.

Optional server settings (see `.env.example`): `AGENT_MODEL`, `AGENT_DAILY_TOKEN_LIMIT`, `AGENT_DESTRUCTIVE_TOOLS`, `MAINTENANCE_MODE`.

## Checks

```bash
npm run typecheck
npm test
npm run lint
```

## Deploy on Vercel

1. Import the repo; Vercel detects Next.js.
2. Add the variables from `.env.example` in Settings → Environment Variables.
3. Apply new migrations before deploying code that depends on them.
