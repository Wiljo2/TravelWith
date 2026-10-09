"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteProps {
  // What is being deleted, shown in the question (e.g. the activity title).
  name: string;
  onConfirm: () => void;
  // Renders the original delete button; calling `ask` swaps it for the confirmation.
  children: (ask: () => void) => ReactNode;
}

export default function ConfirmDelete({ name, onConfirm, children }: ConfirmDeleteProps) {
  const [asking, setAsking] = useState(false);

  if (!asking) return <>{children(() => setAsking(true))}</>;

  return (
    <div
      role="alertdialog"
      aria-label="Confirmar eliminación"
      className="w-full rounded-lg border border-destructive/40 bg-destructive/5 p-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setAsking(false);
        }
      }}
    >
      <p className="mb-2.5 text-[13px] text-foreground">
        ¿Eliminar <strong className="break-words">{name.trim() || "esta actividad"}</strong>?
      </p>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" className="flex-1" autoFocus onClick={onConfirm}>
          Eliminar
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setAsking(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
