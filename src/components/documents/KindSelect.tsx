"use client";
import { DOCUMENT_KINDS, DOCUMENT_KIND_KEYS } from "@/constants/documentKinds";
import type { DocumentKind } from "@/types";

export default function KindSelect({ value, onChange }: { value: DocumentKind; onChange: (kind: DocumentKind) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DocumentKind)}
      aria-label="Tipo de documento"
      className="h-8 shrink-0 cursor-pointer rounded-lg border border-border bg-secondary px-1.5 text-xs text-foreground outline-none"
    >
      {DOCUMENT_KIND_KEYS.map((k) => (
        <option key={k} value={k}>{DOCUMENT_KINDS[k].icon} {DOCUMENT_KINDS[k].label}</option>
      ))}
    </select>
  );
}
