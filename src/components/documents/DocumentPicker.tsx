"use client";
import DocumentLink from "@/components/documents/DocumentLink";
import { documentKind } from "@/constants/documentKinds";
import { cn } from "@/lib/utils";
import type { TripDocument } from "@/types";

// Links an activity or an expense to one of the trip's documents. A documentId
// whose document was removed reads as unlinked.
export default function DocumentPicker({ documents, value, onChange, className }: {
  documents: TripDocument[];
  value?: string;
  onChange: (documentId: string | undefined) => void;
  className?: string;
}) {
  const linked = value ? documents.find((d) => d.id === value) : undefined;
  if (documents.length === 0) return null;
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <select
        value={linked?.id ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label="Documento"
        className={cn(
          "min-w-0 max-w-[180px] cursor-pointer truncate rounded-md border bg-transparent px-[5px] py-0.5 text-[11px] outline-none",
          linked ? "border-border text-foreground" : "border-dashed border-border text-muted-foreground",
        )}
      >
        <option value="">— documento —</option>
        {documents.map((d) => (
          <option key={d.id} value={d.id}>{documentKind(d.kind).icon} {d.title}</option>
        ))}
      </select>
      {linked && <DocumentLink doc={linked} label="Ver" />}
    </div>
  );
}
