import { NextResponse } from "next/server";
import { requireMember } from "@/server/auth";
import { DomainError } from "@/server/domain/core";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { assertWritable } from "@/server/maintenance";
import { runOp } from "@/server/ops";
import { RowConflictError } from "@/server/repo/errors";

type Params = Promise<{ code: string }>;

const MAX_BODY_BYTES = 32 * 1024;

interface OpBody {
  op: string;
  args: unknown;
  expectedVersion?: number;
}

function parseBody(raw: string): OpBody {
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new HttpError(413, "La operación es demasiado grande");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
  const b = body as Partial<OpBody> | null;
  if (!b || typeof b.op !== "string" || typeof b.args !== "object" || b.args === null) {
    throw new HttpError(400, "Se esperaba { op, args, expectedVersion? }");
  }
  if (b.expectedVersion !== undefined && (!Number.isInteger(b.expectedVersion) || b.expectedVersion < 1)) {
    throw new HttpError(400, "expectedVersion inválido");
  }
  return { op: b.op, args: b.args, expectedVersion: b.expectedVersion };
}

// POST /api/rooms/[code]/ops — one small trip change: { op, args, expectedVersion? }.
// 200 → { changed, deleted } rows to reconcile; 409 → { error, table, current }
// when the row changed since expectedVersion (current is null if it was deleted).
export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    assertWritable();
    const { user, role } = await requireMember(req, code);
    const { op, args, expectedVersion } = parseBody(await req.text());
    const result = await runOp(op, { code, userId: user.id, role }, { args, expectedVersion });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof RowConflictError) {
      return NextResponse.json({ error: e.message, table: e.table, current: e.current }, { status: 409 });
    }
    return errorResponse(e, "POST /api/rooms/[code]/ops");
  }
}
