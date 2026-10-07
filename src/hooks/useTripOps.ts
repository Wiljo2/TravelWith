import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { OpQueue, versionEntries, type OpQueueHandlers, type SyncState } from "@/lib/opQueue";
import type { RoomPayload } from "@/types";
import type { Row, TripTable } from "@/utils/tripRows";

export type { SyncState } from "@/lib/opQueue";

export type SendOp = (op: string, args: Record<string, unknown>) => void;
export type IsKnown = (table: TripTable, id: string) => boolean;

export interface TripOpsCallbacks {
  // Store a row as the server has it: after a lost conflict (null = deleted)
  // or for rows the server created.
  adoptRow: (table: TripTable, id: string, row: Row | null) => void;
  applyHeader: (header: Record<string, unknown>) => void;
  // Reload the whole trip after a failed write or a multi-row op.
  resync: () => void;
}

const CONFLICT_NOTICE = "Otro miembro cambió este elemento al mismo tiempo. Se muestra su versión.";
const FAILURE_NOTICE = "No se pudo guardar un cambio. Se recargó el viaje.";

// Sends trip writes as ops (see lib/opQueue). Components update state
// optimistically; this reconciles versions and handles conflicts. In the
// LOCAL demo room (no code or no token) sends are dropped.
export function useTripOps(code: string | null, accessToken: string | undefined, callbacks: TripOpsCallbacks) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const token = useRef(accessToken);
  const cb = useRef(callbacks);
  useEffect(() => {
    token.current = accessToken;
    cb.current = callbacks;
  });

  const queueRef = useRef<OpQueue | null>(null);
  useEffect(() => {
    if (!code || code === "LOCAL") {
      queueRef.current = null;
      return;
    }
    const handlers: OpQueueHandlers = {
      onConflict: (table, id, row) => {
        cb.current.adoptRow(table, id, row);
        setNotice(CONFLICT_NOTICE);
      },
      onFailure: () => {
        setNotice(FAILURE_NOTICE);
        cb.current.resync();
      },
      onResync: () => cb.current.resync(),
      onTrip: (header) => cb.current.applyHeader(header),
      onRows: (rows) => rows.forEach(({ table, row }) => cb.current.adoptRow(table, row.id, row)),
      onState: setSyncState,
      onMaintenance: setMaintenance,
    };
    queueRef.current = new OpQueue(async (op, args, expectedVersion) => {
      const res = await apiFetch(`/api/rooms/${code}/ops`, token.current, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, args, ...(expectedVersion !== undefined ? { expectedVersion } : {}) }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, handlers);
    return () => {
      queueRef.current = null;
    };
  }, [code]);

  const send = useCallback<SendOp>((op, args) => queueRef.current?.send(op, args), []);
  const isKnown = useCallback<IsKnown>((table, id) => queueRef.current?.isKnown(table, id) ?? false, []);
  const seedVersions = useCallback((payload: RoomPayload) => queueRef.current?.seed(versionEntries(payload)), []);
  const noteVersion = useCallback((table: TripTable, id: string, version: number | null) => {
    queueRef.current?.setVersion(table, id, version);
  }, []);
  const acceptRemote = useCallback((table: TripTable, id: string, version: number, deleted: boolean) => {
    return queueRef.current?.acceptRemote(table, id, version, deleted) ?? true;
  }, []);
  const idle = useCallback(() => queueRef.current?.idle() ?? true, []);
  const flush = useCallback(() => queueRef.current?.flush() ?? Promise.resolve(true), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  return { send, isKnown, seedVersions, noteVersion, acceptRemote, idle, flush, syncState, notice, dismissNotice, maintenance };
}
