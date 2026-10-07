import type { DocumentKind } from "@/types";

export interface DocumentKindInfo {
  label: string;
  icon: string;
}

export const DOCUMENT_KINDS: Record<DocumentKind, DocumentKindInfo> = {
  flight:    { label: "Vuelo",      icon: "✈️" },
  lodging:   { label: "Hospedaje",  icon: "🏨" },
  insurance: { label: "Seguro",     icon: "🛡️" },
  ticket:    { label: "Entrada",    icon: "🎟️" },
  other:     { label: "Otro",       icon: "📄" },
};

export const DOCUMENT_KIND_KEYS = Object.keys(DOCUMENT_KINDS) as DocumentKind[];
export const DEFAULT_DOCUMENT_KIND: DocumentKind = "other";

export const documentKind = (kind: string | undefined): DocumentKindInfo =>
  DOCUMENT_KINDS[kind as DocumentKind] ?? DOCUMENT_KINDS[DEFAULT_DOCUMENT_KIND];
