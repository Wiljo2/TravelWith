import { HttpError } from "@/server/http";
import type { TripTable } from "@/types/database";

// A write based on a stale row version. `current` is the row as stored now, so
// the client can adopt it instead of overwriting another member's change.
export class RowConflictError<Row = unknown> extends HttpError {
  constructor(public table: TripTable, public id: string, public current: Row) {
    super(409, "Otro miembro cambió este elemento. Se muestra la versión actual.");
  }
}

export class RowNotFoundError extends HttpError {
  constructor(public table: TripTable, public id: string) {
    super(404, "El elemento ya no existe");
  }
}

interface PostgrestLikeError {
  code?: string;
  message: string;
}

// Constraint violations become user-facing errors; anything else stays a plain
// Error so errorResponse logs it and answers a generic 500.
export function repoError(error: PostgrestLikeError): Error {
  switch (error.code) {
    case "23505":
      return new HttpError(409, "Ya existe un elemento con ese id");
    case "23503":
      return new HttpError(409, "Un elemento relacionado ya no existe");
    case "23502":
    case "23514":
    case "22P02":
      return new HttpError(400, "Datos inválidos");
    default:
      return new Error(`[repo] ${error.code ?? "unknown"}: ${error.message}`);
  }
}
