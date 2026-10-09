"use client";
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { activitySentence, activityTime, groupByDay } from "@/utils/activityText";
import type { ActivityEntry } from "@/types";

interface ActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
  accessToken: string | undefined;
}

// Trip history from trip_changes: who changed what, newest first.
export default function ActivityDialog({ open, onOpenChange, roomCode, accessToken }: ActivityDialogProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const load = useCallback(async (before?: number) => {
    setStatus("loading");
    try {
      const qs = before ? `?before=${before}` : "";
      const res = await apiFetch(`/api/rooms/${roomCode}/changes${qs}`, accessToken);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { entries: ActivityEntry[]; next: number | null };
      setEntries((prev) => (before ? [...prev, ...body.entries] : body.entries));
      setNext(body.next);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [roomCode, accessToken]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const groups = groupByDay(entries);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-[480px] overflow-y-auto">
        <DialogHeader><DialogTitle>Actividad</DialogTitle></DialogHeader>
        {status === "error" && <p className="text-sm text-destructive">No se pudo cargar la actividad. Intenta de nuevo.</p>}
        {status !== "error" && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">{status === "loading" ? "Cargando…" : "Todavía no hay cambios registrados."}</p>
        )}
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.day}>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.day}</h3>
              <ul className="space-y-1.5">
                {g.entries.map((e) => (
                  <li key={e.id} className="flex gap-3 text-[13px] leading-snug">
                    <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{activityTime(e.at)}</span>
                    <span className="text-foreground">{activitySentence(e)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {next !== null && (
          <Button variant="outline" size="sm" disabled={status === "loading"} onClick={() => void load(next)}>
            Ver más
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
