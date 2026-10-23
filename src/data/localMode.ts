// Local mode: boots the whole app against in-memory demo data — no Supabase, no
// Google sign-in, nothing saved. `useRoom`, `useTripChannel` and `useTripOps`
// short-circuit on this code. Dev builds only; the flag lets the bundler drop the demo
// (`data/mockRoom.ts`, loaded with a dynamic import) from production.
export const LOCAL_ROOM_CODE = "LOCAL";
export const LOCAL_MODE_ENABLED = process.env.NODE_ENV !== "production";

// "demo" = the filled-in example trip (or a local snapshot); "new" = the empty trip a
// first-time user creates in the `?local=new` sandbox (see `data/localSandbox.ts`).
export type LocalVariant = "demo" | "new";

export function openLocalDemo() {
  const url = new URL(window.location.href);
  url.searchParams.set("local", "1");
  window.history.replaceState(null, "", url);
}
