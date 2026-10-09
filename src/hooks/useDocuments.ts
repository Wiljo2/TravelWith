import { useCallback, useState } from "react";
import type { RoomPayload, TripDocument } from "@/types";
import { applyToList, rowToDocument, type Row } from "@/utils/tripRows";

export function useDocuments() {
  const [documents, setDocuments] = useState<TripDocument[]>([]);

  function addDocument(doc: Omit<TripDocument, "id">) {
    setDocuments((prev) => [...prev, { id: crypto.randomUUID(), ...doc }]);
  }
  function updateDocument(id: string, patch: Partial<Omit<TripDocument, "id" | "driveFileId">>) {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  // Events and expenses keep a dangling documentId; pickers treat it as unlinked.
  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }
  const loadPayload = useCallback((payload: RoomPayload) => {
    setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
  }, []);

  const applyRow = useCallback((id: string, row: Row | null) => {
    setDocuments((prev) => applyToList(prev, id, row, rowToDocument));
  }, []);

  return { documents, addDocument, updateDocument, removeDocument, loadPayload, applyRow };
}
