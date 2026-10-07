"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import KindSelect from "@/components/documents/KindSelect";
import { DEFAULT_DOCUMENT_KIND } from "@/constants/documentKinds";
import { LIMITS } from "@/constants/limits";
import { parseDriveFileId } from "@/utils/driveLinks";
import type { DocumentKind, TripDocument } from "@/types";

// Paste a Drive link: only the file id is kept, the link itself is never stored.
export default function AddDocumentForm({ documents, onAdd }: {
  documents: TripDocument[];
  onAdd: (doc: Omit<TripDocument, "id">) => void;
}) {
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>(DEFAULT_DOCUMENT_KIND);
  const [error, setError] = useState<string | null>(null);
  const full = documents.length >= LIMITS.documents;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const driveFileId = parseDriveFileId(link);
    if (!driveFileId) { setError("No parece un link de un archivo de Google Drive. En Drive: Compartir → Copiar link."); return; }
    if (documents.some((d) => d.driveFileId === driveFileId)) { setError("Ese archivo ya está en la lista."); return; }
    if (!title.trim()) { setError("Ponle un título corto, sin datos personales."); return; }
    onAdd({ driveFileId, title: title.trim(), kind });
    setLink(""); setTitle(""); setKind(DEFAULT_DOCUMENT_KIND); setError(null);
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <Input
        value={link}
        onChange={(e) => { setLink(e.target.value); setError(null); }}
        placeholder="https://drive.google.com/file/d/…"
        inputMode="url"
        aria-label="Link de Google Drive"
        className="h-9 bg-secondary text-xs"
      />
      <div className="flex gap-2">
        <KindSelect value={kind} onChange={setKind} />
        <Input
          value={title}
          maxLength={LIMITS.documentTitle}
          onChange={(e) => { setTitle(e.target.value); setError(null); }}
          placeholder="Vuelo ida BOG→MAD"
          aria-label="Título del documento"
          className="h-8 min-w-0 flex-1 text-[13px]"
        />
        <Button type="submit" disabled={full || !link.trim()}>Añadir</Button>
      </div>
      <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {error ?? "El archivo sigue en Drive. Solo lo abre quien tenga acceso a la carpeta compartida."}
      </p>
    </form>
  );
}
