// Local mode: boots the whole app against in-memory demo data — no Supabase, no
// Google sign-in, nothing saved. `useRoom`, `useTripChannel` and `useTripOps`
// short-circuit on this code. Dev builds only; the flag lets the bundler drop the demo
// (`data/mockRoom.ts`, loaded with a dynamic import) from production.
export const LOCAL_ROOM_CODE = "LOCAL";
export const LOCAL_MODE_ENABLED = process.env.NODE_ENV !== "production";
