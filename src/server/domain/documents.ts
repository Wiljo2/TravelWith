import type { RoomPayload, TripDocument, DocumentKind } from "@/types";
import { LIMITS } from "@/constants/limits";
import { DOCUMENT_KINDS, DEFAULT_DOCUMENT_KIND } from "@/constants/documentKinds";
import { DRIVE_ID_RE } from "@/utils/driveLinks";
import { DomainError, checkArgs, requireEvent } from "./core";

const DOCUMENT_FIELDS = {
  driveFileId: { type: "string", max: LIMITS.id },
  title: { type: "string", max: LIMITS.documentTitle },
  kind: { type: "string", max: LIMITS.id },
} as const;

function validateDriveFileId(driveFileId: string) {
  if (!DRIVE_ID_RE.test(driveFileId)) {
    throw new DomainError("driveFileId must be a plain Google Drive file id (letters, digits, - and _), not a link");
  }
}

function validateKind(kind: string): asserts kind is DocumentKind {
  if (!(kind in DOCUMENT_KINDS)) {
    throw new DomainError(`Invalid kind "${kind}". Valid: ${Object.keys(DOCUMENT_KINDS).join(", ")}`);
  }
}

function validateTitle(title: string): string {
  const t = title.trim();
  if (!t) throw new DomainError("title is required");
  return t;
}

function requireDocument(payload: RoomPayload, documentId: string): TripDocument {
  const doc = (payload.documents ?? []).find((d) => d.id === documentId);
  if (!doc) throw new DomainError(`Document "${documentId}" not found`);
  return doc;
}

export interface AddDocumentArgs {
  driveFileId: string;
  title: string;
  kind?: string;
}

export function addDocument(payload: RoomPayload, args: AddDocumentArgs): { payload: RoomPayload; document: TripDocument } {
  checkArgs(args, {
    ...DOCUMENT_FIELDS,
    driveFileId: { ...DOCUMENT_FIELDS.driveFileId, required: true },
    title: { ...DOCUMENT_FIELDS.title, required: true },
  });
  const documents = payload.documents ?? [];
  if (documents.length >= LIMITS.documents) throw new DomainError(`The trip already has ${LIMITS.documents} documents`);
  validateDriveFileId(args.driveFileId);
  if (documents.some((d) => d.driveFileId === args.driveFileId)) {
    throw new DomainError("That Drive file is already linked to the trip");
  }
  const kind = args.kind ?? DEFAULT_DOCUMENT_KIND;
  validateKind(kind);

  const document: TripDocument = { id: crypto.randomUUID(), driveFileId: args.driveFileId, title: validateTitle(args.title), kind };
  return { payload: { ...payload, documents: [...documents, document] }, document };
}

export interface UpdateDocumentArgs {
  title?: string;
  kind?: string;
}

export function updateDocument(
  payload: RoomPayload,
  documentId: string,
  patch: UpdateDocumentArgs,
): { payload: RoomPayload; document: TripDocument } {
  checkArgs(patch, { title: DOCUMENT_FIELDS.title, kind: DOCUMENT_FIELDS.kind });
  const current = requireDocument(payload, documentId);
  if (patch.kind !== undefined) validateKind(patch.kind);

  const next: TripDocument = {
    ...current,
    ...(patch.title !== undefined ? { title: validateTitle(patch.title) } : {}),
    ...(patch.kind !== undefined ? { kind: patch.kind as DocumentKind } : {}),
  };
  const documents = (payload.documents ?? []).map((d) => (d.id === documentId ? next : d));
  return { payload: { ...payload, documents }, document: next };
}

// Removing a document also clears every reference to it.
export function removeDocument(payload: RoomPayload, documentId: string): { payload: RoomPayload; document: TripDocument } {
  const document = requireDocument(payload, documentId);
  const unlink = <T extends { documentId?: string }>(x: T): T =>
    x.documentId === documentId ? { ...x, documentId: undefined } : x;
  return {
    payload: {
      ...payload,
      documents: (payload.documents ?? []).filter((d) => d.id !== documentId),
      days: payload.days.map((d) => ({ ...d, events: d.events.map(unlink) })),
      extras: payload.extras.map(unlink),
    },
    document,
  };
}

export type DocumentTarget = { eventId: string } | { extraId: string };

// Points an event or an expense at a document; documentId undefined unlinks it.
export function linkDocument(
  payload: RoomPayload,
  target: DocumentTarget,
  documentId: string | undefined,
): { payload: RoomPayload } {
  if (documentId !== undefined) requireDocument(payload, documentId);

  if ("eventId" in target) {
    requireEvent(payload, target.eventId);
    const days = payload.days.map((d) => ({
      ...d,
      events: d.events.map((e) => (e.id === target.eventId ? { ...e, documentId } : e)),
    }));
    return { payload: { ...payload, days } };
  }

  if (!payload.extras.some((x) => x.id === target.extraId)) {
    throw new DomainError(`Expense "${target.extraId}" not found. Use get_budget to list current expense ids.`);
  }
  const extras = payload.extras.map((x) => (x.id === target.extraId ? { ...x, documentId } : x));
  return { payload: { ...payload, extras } };
}
