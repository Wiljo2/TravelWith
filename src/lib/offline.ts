import type { RoomPayload } from "@/hooks/useRoom";
import type { RoomMember } from "@/types";

// The last copy of each trip this device saw, so the app can show it without
// internet (e.g. at immigration on arrival). Refreshed on every load, remote
// update and save. Per-device only: it is a read-only fallback, never synced.

export interface RoomSnapshot {
  payload: RoomPayload;
  members: RoomMember[];
  savedAt: string;   // ISO time this copy was taken
}

const ROOM_KEY = (code: string) => `tw:room:${code}`;
const LAST_KEY = "tw:lastRoom";
const ROOMS_KEY = (userId: string) => `tw:rooms:${userId}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full or unavailable: the snapshot is best-effort */ }
}

export function saveSnapshot(code: string, snap: Omit<RoomSnapshot, "savedAt">) {
  write(ROOM_KEY(code), { ...snap, savedAt: new Date().toISOString() });
  write(LAST_KEY, code);
}

// After a save the payload changed but the members didn't.
export function updateSnapshotPayload(code: string, payload: RoomPayload) {
  saveSnapshot(code, { payload, members: loadSnapshot(code)?.members ?? [] });
}

export function loadSnapshot(code: string): RoomSnapshot | null {
  const snap = read<RoomSnapshot>(ROOM_KEY(code));
  return snap && Array.isArray(snap.payload?.days) ? snap : null;
}

export function lastSnapshotCode(): string | null {
  const code = read<string>(LAST_KEY);
  return code && loadSnapshot(code) ? code : null;
}

// The signed-in user's trip list ("Mis viajes"), for picking a trip offline.
export function saveRoomList<T>(userId: string, rooms: T[]) {
  write(ROOMS_KEY(userId), rooms);
}

export function loadRoomList<T>(userId: string): T[] {
  return read<T[]>(ROOMS_KEY(userId)) ?? [];
}

// The browser knows it has no network. It can't tell a captive portal apart,
// so callers also treat a failed fetch as offline.
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
