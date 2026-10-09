import type { DocumentKind } from "@/types";
import { DOCUMENT_KINDS } from "@/constants/documentKinds";
import { DRIVE_ID_RE } from "@/utils/driveLinks";
import { DomainError } from "./core";

export function validateDriveFileId(driveFileId: string) {
  if (!DRIVE_ID_RE.test(driveFileId)) {
    throw new DomainError("driveFileId must be a plain Google Drive file id (letters, digits, - and _), not a link");
  }
}

export function validateKind(kind: string): asserts kind is DocumentKind {
  if (!(kind in DOCUMENT_KINDS)) {
    throw new DomainError(`Invalid kind "${kind}". Valid: ${Object.keys(DOCUMENT_KINDS).join(", ")}`);
  }
}

export function validateTitle(title: string): string {
  const t = title.trim();
  if (!t) throw new DomainError("title is required");
  return t;
}
