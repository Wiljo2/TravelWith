"use client";
import { useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import type { Idea } from "@/types";

interface IdeaNoteProps {
  idea: Idea;
  onSetNote: (note: string) => void;
  // Re-fetch the post data (TikTok/YouTube). Resolves with the enriched idea.
  onRetry?: () => Promise<Idea | null>;
}

// The member's note: the main input for classification. Ideas without any text
// (Instagram, or a TikTok that didn't answer) ask for one explicitly.
export default function IdeaNote({ idea, onSetNote, onRetry }: IdeaNoteProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(idea.note ?? "");
  const [retry, setRetry] = useState<"idle" | "loading" | "failed">("idle");
  const missingText = !idea.title && !idea.note;

  function save() {
    onSetNote(draft);
    setEditing(false);
  }

  async function refetch() {
    if (!onRetry) return;
    setRetry("loading");
    setRetry((await onRetry())?.title ? "idle" : "failed");
  }

  if (editing || missingText) {
    return (
      <div className={missingText && !editing ? "mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900" : "mt-2"}>
        {missingText && !editing && (
          <p className="mb-2">
            {idea.platform === "tiktok"
              ? "TikTok no nos dio el texto de este video (limita las consultas). "
              : idea.platform === "instagram"
                ? "Instagram no comparte el texto de los posts. "
                : "Este link no trae texto. "}
            Escribe de qué se trata para poder clasificarla.
          </p>
        )}
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            onFocus={() => setEditing(true)}
            placeholder="ej. playa en Nassau, cena en Miami…"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none"
          />
          <button
            onClick={save}
            disabled={!draft.trim() && !idea.note}
            className="h-8 cursor-pointer rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
        {missingText && !editing && onRetry && idea.platform === "tiktok" && (
          <button
            onClick={refetch}
            disabled={retry === "loading"}
            className="mt-2 flex cursor-pointer items-center gap-1.5 font-medium text-amber-800 hover:underline disabled:opacity-60"
          >
            <RefreshCw className={retry === "loading" ? "size-3.5 animate-spin" : "size-3.5"} />
            {retry === "loading" ? "Consultando TikTok…" : retry === "failed" ? "TikTok sigue sin responder · reintentar" : "Reintentar leer el texto"}
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(idea.note ?? ""); setEditing(true); }}
      className="group mt-1 flex max-w-full cursor-pointer items-start gap-1 text-left text-xs text-secondary-foreground"
      title="Editar nota"
    >
      {/* Without a post caption the note is already the card's heading. */}
      <span className="line-clamp-2 italic">{!idea.note ? "Agregar nota" : idea.title ? `“${idea.note}”` : "Editar nota"}</span>
      <Pencil className="mt-0.5 size-3 shrink-0 opacity-50 group-hover:opacity-100" />
    </button>
  );
}
