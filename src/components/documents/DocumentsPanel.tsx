"use client";
import AddDocumentForm from "@/components/documents/AddDocumentForm";
import DocumentRow from "@/components/documents/DocumentRow";
import { PANEL, SectionTitle } from "@/components/home/shared";
import type { TripDocument } from "@/types";

interface DocumentsPanelProps {
  documents: TripDocument[];
  onAdd: (doc: Omit<TripDocument, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<TripDocument, "id" | "driveFileId">>) => void;
  onRemove: (id: string) => void;
}

// Reservations, tickets and insurance kept in Google Drive, linked by reference only.
export default function DocumentsPanel({ documents, onAdd, onUpdate, onRemove }: DocumentsPanelProps) {
  return (
    <section className={PANEL}>
      <SectionTitle title="Documentos" count={documents.length} />
      {documents.length === 0 ? (
        <p className="text-[13px] text-secondary-foreground">
          Enlaza aquí reservas, tiquetes y seguros que están en Google Drive para tenerlos a mano.
        </p>
      ) : (
        <ul className="-mx-1 flex flex-col divide-y divide-border">
          {documents.map((d) => (
            <DocumentRow key={d.id} doc={d} onCommit={(patch) => onUpdate(d.id, patch)} onRemove={() => onRemove(d.id)} />
          ))}
        </ul>
      )}
      <AddDocumentForm documents={documents} onAdd={onAdd} />
    </section>
  );
}
