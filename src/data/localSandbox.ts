import type { User } from "@supabase/supabase-js";
import type { TripInfo } from "@/types";
import { LOCAL_MODE_ENABLED, type LocalVariant } from "@/data/localMode";

// "Brand-new user" local mode (`?local=new`, dev builds only): the tab walks the real
// first-run flow — landing, sign-in, empty "Mis viajes", "Nuevo viaje" — but sign-in
// accepts any email and password and the trip lives in memory. State is per tab
// (sessionStorage) and starts over every time `?local=new` is opened.
const FLAG_KEY = "tw-local-sandbox";
const USER_KEY = "tw-local-sandbox-user";
const TRIP_KEY = "tw-local-sandbox-trip";
const CHANGE_EVENT = "tw-local-sandbox-change";

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isSandbox(): boolean {
  return LOCAL_MODE_ENABLED && typeof window !== "undefined" && read(FLAG_KEY) === "1";
}

export function startSandbox() {
  write(USER_KEY, null);
  write(TRIP_KEY, null);
  write(FLAG_KEY, "1");
}

export function onSandboxChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export function sandboxUser(): User | null {
  const raw = read(USER_KEY);
  if (!raw) return null;
  const { email, name } = JSON.parse(raw) as { email: string; name: string };
  return {
    id: "local-user",
    email,
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
    app_metadata: {},
    user_metadata: { full_name: name },
  } as User;
}

export function signInSandbox(email: string, name?: string) {
  write(USER_KEY, JSON.stringify({ email, name: name?.trim() || email.split("@")[0] }));
}

export function signOutSandbox() {
  write(USER_KEY, null);
}

export function sandboxTrip(): TripInfo | null {
  const raw = read(TRIP_KEY);
  return raw ? (JSON.parse(raw) as TripInfo) : null;
}

export function setSandboxTrip(trip: TripInfo | null) {
  write(TRIP_KEY, trip ? JSON.stringify(trip) : null);
}

// The demo opened explicitly (`?local=1`) wins over the sandbox.
export function localVariant(): LocalVariant {
  if (new URLSearchParams(window.location.search).get("local") === "1") return "demo";
  return isSandbox() ? "new" : "demo";
}
