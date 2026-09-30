"use client";
import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { findIdeaUrls } from "@/utils/ideas";

interface AddIdeaFormProps {
  // Returns how many new ideas were added (duplicates are skipped).
  onSubmit: (text: string, note: string) => number;
  onDone: () => void;
}

export default function AddIdeaForm({ onSubmit, onDone }: AddIdeaFormProps) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const found = findIdeaUrls(text).length;
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  async function paste() {
    try {
      const clip = await navigator.clipboard.readText();
      setText((t) => (t ? `${t}\n${clip}` : clip));
    } catch {
      setMessage("No se pudo leer el portapapeles. Pega el link a mano.");
    }
  }

  function submit() {
    const added = onSubmit(text, note);
    if (added === 0) {
      setMessage(found > 0 ? "Esos links ya estaban en las ideas." : "No encontré links en el texto.");
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setMessage(""); }}
          placeholder="Pega uno o varios links de TikTok, Instagram o YouTube (también sirve un mensaje de WhatsApp completo)"
          rows={4}
          className="min-h-24 resize-none bg-secondary text-sm"
        />
        {canPaste && (
          <button
            onPointerDown={(e) => e.preventDefault()}
            onClick={paste}
            className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium ring-1 ring-border hover:bg-secondary"
          >
            <ClipboardPaste className="size-3.5" /> Pegar
          </button>
        )}
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="¿Para qué día o qué es? (opcional) · ej. cena en Miami"
        className="bg-secondary text-sm"
      />
      <p className="text-xs text-muted-foreground">
        La nota ayuda mucho a clasificarla: de Instagram no podemos leer el texto del post.
      </p>
      {message && <p className="text-xs text-destructive">{message}</p>}
      {/* Keep focus in the field on press: otherwise the first tap only closes the
          phone keyboard, the sheet shifts, and the tap misses the button. */}
      <Button
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={submit}
        disabled={found === 0}
        className="h-10 font-semibold"
      >
        {found > 1 ? `Agregar ${found} ideas` : "Agregar idea"}
      </Button>
    </div>
  );
}
