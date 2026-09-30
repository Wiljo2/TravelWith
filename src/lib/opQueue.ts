import { OP_TABLES, type Row, type TripTable } from "@/utils/tripRows";

// Client side of POST /api/rooms/[code]/ops. Ops on the same item run one at
// a time, in order, so each one carries the version the previous response
// returned; queued updates of the same item are merged (typing in a field
// sends one request per round trip, not per keystroke). Versions come from
// the loaded trip, from op responses and, later, from Broadcast.

export interface OpResponse {
  status: number;
  body: unknown;
}

export type PostOp = (op: string, args: Record<string, unknown>, expectedVersion?: number) => Promise<OpResponse>;

export type SyncState = "idle" | "saving" | "saved" | "error";

export interface OpQueueHandlers {
  onConflict: (table: TripTable, id: string, current: Row | null) => void;
  onFailure: (op: string, status: number) => void;
  onResync: () => void;
  onTrip: (header: Record<string, unknown>) => void;
  onRows: (rows: { table: TripTable; row: Row }[]) => void;
  onState: (state: SyncState) => void;
}

interface QueuedOp {
  op: string;
  args: Record<string, unknown>;
}

interface ChangeBody {
  changed?: { table: TripTable; row: Row }[];
  deleted?: { table: TripTable; id: string }[];
  trip?: Record<string, unknown>;
  table?: TripTable;
  current?: Row | null;
}

// Ops whose rows the client did not create optimistically: apply the response.
const APPLY_RESPONSE = new Set(["task.chooseOption"]);

const MERGEABLE = (op: string) => op.endsWith(".update") || op === "event.move" || op === "trip.setExchangeRate";
const GUARDED = (op: string) =>
  op.endsWith(".update") || op.endsWith(".delete") || op === "event.move" || op === "task.toggle" ||
  op === "task.chooseOption" || op === "traveler.remove";

export function opTarget(op: string, args: Record<string, unknown>): { key: string; table?: TripTable; id?: string } {
  const prefix = op.split(".")[0];
  if (op === "task.chooseOption") {
    const id = String(args.taskId);
    return { key: `trip_tasks:${id}`, table: "trip_tasks", id };
  }
  const table = OP_TABLES[prefix];
  if (op === "day.swap" || op === "itinerary.reset" || !table || typeof args.id !== "string") return { key: prefix === "day" ? "days" : prefix };
  return { key: `${table}:${args.id}`, table, id: args.id };
}

export class OpQueue {
  private versions = new Map<string, number>();
  private queues = new Map<string, QueuedOp[]>();
  private busy = new Set<string>();
  private pendingCreates = new Set<string>();
  private failed = false;

  constructor(private post: PostOp, private handlers: OpQueueHandlers) {}

  // Replaces known versions (after loading or refetching the trip).
  seed(entries: Iterable<[string, number]>) {
    this.versions = new Map(entries);
  }

  setVersion(table: TripTable, id: string, version: number | null) {
    const key = `${table}:${id}`;
    if (version === null) this.versions.delete(key);
    else if ((this.versions.get(key) ?? 0) < version) this.versions.set(key, version);
  }

  // Whether the server has (or is about to have) this item: updates and
  // deletes of items it never saw must not be sent.
  isKnown(table: TripTable, id: string): boolean {
    const key = `${table}:${id}`;
    return this.versions.has(key) || this.pendingCreates.has(key);
  }

  send(op: string, args: Record<string, unknown>) {
    const { key } = opTarget(op, args);
    const queue = this.queues.get(key) ?? [];
    const last = queue[queue.length - 1];
    if (last && last.op === op && MERGEABLE(op)) last.args = { ...last.args, ...args };
    else queue.push({ op, args });
    this.queues.set(key, queue);
    if (op.endsWith(".create") || op === "traveler.add") this.pendingCreates.add(key);
    this.emitState();
    void this.pump(key);
  }

  private pending(): number {
    let n = this.busy.size;
    for (const q of this.queues.values()) n += q.length;
    return n;
  }

  private emitState() {
    this.handlers.onState(this.pending() > 0 ? "saving" : this.failed ? "error" : "saved");
  }

  private async pump(key: string) {
    if (this.busy.has(key)) return;
    const next = this.queues.get(key)?.shift();
    if (!next) {
      this.queues.delete(key);
      return;
    }
    this.busy.add(key);
    const { table, id } = opTarget(next.op, next.args);
    const expected = GUARDED(next.op) ? this.versions.get(key) : undefined;

    let res: OpResponse;
    try {
      res = await this.post(next.op, next.args, expected);
    } catch {
      res = { status: 0, body: null };
    }
    this.pendingCreates.delete(key);
    this.handle(next.op, table, id, res);

    this.busy.delete(key);
    this.emitState();
    void this.pump(key);
  }

  private handle(op: string, table: TripTable | undefined, id: string | undefined, res: OpResponse) {
    const body = (res.body ?? {}) as ChangeBody;
    if (res.status === 200) {
      this.failed = false;
      for (const c of body.changed ?? []) this.setVersion(c.table, c.row.id, c.row.version);
      for (const d of body.deleted ?? []) this.setVersion(d.table, d.id, null);
      if (body.trip) this.handlers.onTrip(body.trip);
      if (APPLY_RESPONSE.has(op)) this.handlers.onRows(body.changed ?? []);
      if (op === "itinerary.reset") this.handlers.onResync();
      return;
    }
    if (res.status === 409 && table && id) {
      const current = body.current ?? null;
      this.setVersion(body.table ?? table, id, current ? current.version : null);
      this.handlers.onConflict(body.table ?? table, id, current);
      return;
    }
    this.failed = true;
    this.handlers.onFailure(op, res.status);
  }
}

// Versions of every item in a loaded trip, keyed like the queue.
export function versionEntries(payload: {
  days?: { id: string; version?: number; events?: { id: string; version?: number }[]; spans?: { id: string; version?: number }[] }[];
  extras?: { id: string; version?: number }[];
  tripSpans?: { id: string; version?: number }[];
  tasks?: { id: string; version?: number; options?: { id: string; version?: number }[] }[];
  mockPeople?: { id: string; version?: number }[];
}): [string, number][] {
  const out: [string, number][] = [];
  const add = (table: TripTable, items: { id: string; version?: number }[] | undefined) => {
    for (const x of items ?? []) if (x.version !== undefined) out.push([`${table}:${x.id}`, x.version]);
  };
  add("trip_days", payload.days);
  for (const d of payload.days ?? []) {
    add("trip_events", d.events);
    add("trip_day_spans", d.spans);
  }
  add("trip_expenses", payload.extras);
  add("trip_spans", payload.tripSpans);
  add("trip_tasks", payload.tasks);
  for (const t of payload.tasks ?? []) add("trip_task_options", t.options);
  add("trip_travelers", payload.mockPeople);
  return out;
}

// Text fields the server rejects when empty stay local until they have content.
export function sendable(args: Record<string, unknown>): Record<string, unknown> | null {
  const out = Object.fromEntries(
    Object.entries(args).filter(([k, v]) => !(["title", "label", "name"].includes(k) && typeof v === "string" && !v.trim())),
  );
  return Object.keys(out).some((k) => k !== "id") ? out : null;
}
