"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DocumentLink from "@/components/documents/DocumentLink";
import KindSelect from "@/components/documents/KindSelect";
import { DEFAULT_DOCUMENT_KIND } from "@/constants/documentKinds";
import { LIMITS } from "@/constants/limits";
import { cn } from "@/lib/utils";
import type { DocumentKind, TripDocument } from "@/types";

// Rename / re-kind with the dirty + ✓/✕ pattern; × removes the reference (the file stays in Drive).
export default function DocumentRow({ doc, onCommit, onRemove }: {
  doc: TripDocument;
  onCommit: (patch: { title: string; kind: DocumentKind }) => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [kind, setKind] = useState<DocumentKind>(doc.kind ?? DEFAULT_DOCUMENT_KIND);
  const [dirty, setDirty] = useState(false);

  function commit() {
    if (!title.trim()) return;
    onCommit({ title: title.trim(), kind });
    setDirty(false);
  }
  function cancel() { setTitle(doc.title); setKind(doc.kind ?? DEFAULT_DOCUMENT_KIND); setDirty(false); }

  return (
    <li className={cn("flex flex-wrap items-center gap-2 py-2", dirty && "rounded-lg bg-primary/5")}>
      <KindSelect value={kind} onChange={(k) => { setKind(k); setDirty(true); }} />
      <Input
        value={title}
        maxLength={LIMITS.documentTitle}
        onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
        aria-label="Título del documento"
        className="h-8 min-w-0 flex-1 basis-40 border-transparent bg-transparent px-1 text-[13px] hover:border-border"
      />
      {dirty ? (
        <div className="flex gap-1">
          <Button size="icon-sm" onClick={commit} disabled={!title.trim()} aria-label="Guardar"><Check /></Button>
          <Button size="icon-sm" variant="secondary" onClick={cancel} aria-label="Cancelar"><X /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <DocumentLink doc={doc} label="Ver" />
          <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label="Quitar documento" className="text-muted-foreground">
            <X />
          </Button>
        </div>
      )}
    </li>
  );
}
