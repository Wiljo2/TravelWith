"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findIdeaUrls } from "@/utils/ideas";

interface ReelLinkFormProps {
  onSubmit: (text: string) => void;
}

export default function ReelLinkForm({ onSubmit }: ReelLinkFormProps) {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (findIdeaUrls(text).length === 0) return setInvalid(true);
    onSubmit(text.trim());
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl bg-secondary p-3">
      <div className="flex gap-2">
        <Input
          autoFocus
          value={text}
          onChange={(e) => { setText(e.target.value); setInvalid(false); }}
          placeholder="Pega el enlace del video"
          inputMode="url"
          aria-label="Enlace de TikTok, Instagram o YouTube"
          aria-invalid={invalid || undefined}
          className="h-10 flex-1 bg-card"
        />
        <Button type="submit" disabled={!text.trim()} className="h-10 px-4 font-semibold">
          Agregar
        </Button>
      </div>
      {invalid && (
        <p className="text-xs text-destructive">No encontré un enlace. Pega el de un TikTok, reel o video de YouTube.</p>
      )}
    </form>
  );
}
