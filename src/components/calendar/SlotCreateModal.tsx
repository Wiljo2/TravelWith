"use client";
import { useState } from "react";
import type { Task, TaskPriority } from "@/types";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT, PRIORITIES, PRIORITY_ORDER } from "@/constants/taskCategories";
import { CATEGORIES } from "@/constants/categories";
import { fmtHour } from "@/utils/time";
import { findGoogleMapsLink } from "@/utils/googleMaps";
import { rootZoom } from "@/utils/zoom";
import { HOUR_END } from "@/constants/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/useMediaQuery";

const DURATIONS = [0.5, 1, 2, 3] as const;
const CAT_KEYS = Object.keys(CATEGORIES);

interface SlotCreateModalProps {
  x: number;
  y: number;
  dayLabel: string;
  hour: number;
  existing?: Task | null;
  onSaveActivity: (fields: { title: string; note: string; cat: string; start: number; end: number; mapsUrl?: string }) => void;
  onSaveTask: (patch: Partial<Task>) => void;
  onDeleteTask?: () => void;
  onClose: () => void;
}

export default function SlotCreateModal({
  x, y, dayLabel, hour, existing,
  onSaveActivity, onSaveTask, onDeleteTask, onClose,
}: SlotCreateModalProps) {
  const mobile = useIsMobile();
  const editing = !!existing;
  const startHour = existing?.start ?? hour;
  const [tab, setTab] = useState<"activity" | "task">(editing ? "task" : "activity");

  const [title, setTitle]       = useState(existing?.title ?? "");
  const [note, setNote]         = useState(existing?.note ?? "");
  const [maps, setMaps]         = useState("");
  const [dur, setDur]           = useState<number>(existing?.end && existing?.start ? existing.end - existing.start : 1);
  const [actCat, setActCat]     = useState<string>("miami");
  const [taskCat, setTaskCat]   = useState<string>(existing?.cat ?? DEFAULT_TASK_CAT);
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? "media");

  // Optional Google Maps link (activities only): must really be one.
  const mapsLink = maps.trim() ? findGoogleMapsLink(maps) : undefined;
  const mapsInvalid = !!maps.trim() && !mapsLink;
  const canSave = title.trim().length > 0 && !mapsInvalid;

  function save() {
    if (!canSave) return;
    const start = startHour;
    const end = Math.min(start + dur, HOUR_END);
    if (tab === "activity") onSaveActivity({ title: title.trim(), note: note.trim(), cat: actCat, start, end, mapsUrl: mapsLink });
    else onSaveTask({ title: title.trim(), note: note.trim(), cat: taskCat, priority, start, end });
  }

  // x/y arrive as client coordinates; the modal is positioned inside the zoomed
  // body, so both the cursor point and the viewport bounds go back to local px.
  const W = 288;
  const H = 480;
  const z = rootZoom();
  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - (W + 12) * z) / z : x;
  const top  = typeof window !== "undefined" ? Math.min(y, window.innerHeight - H * z) / z : y;

  const where = <><strong className="text-secondary-foreground">{dayLabel}</strong> · {fmtHour(startHour)}</>;

  const fields = (
    <>
      {!editing && (
        <div className="flex gap-1.5">
          <TypeButton active={tab === "activity"} onClick={() => setTab("activity")} icon="📌" label="Actividad" />
          <TypeButton active={tab === "task"} onClick={() => setTab("task")} icon="💬" label="Tarea" />
        </div>
      )}

      <Input
        autoFocus={!mobile}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) save(); if (e.key === "Escape") onClose(); }}
        placeholder={tab === "activity" ? "Nombre de la actividad" : "¿Qué hay que hablar? (ej. ¿Excursión?)"}
        className="bg-secondary text-[13px]"
      />

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={tab === "activity" ? "Nota…" : "Qué se va a discutir / decidir…"}
        rows={2}
        className="min-h-0 bg-secondary text-xs leading-normal"
      />

      {tab === "activity" && (
        <div>
          <Input
            value={maps}
            onChange={(e) => setMaps(e.target.value)}
            placeholder="Link de Google Maps (opcional)"
            inputMode="url"
            aria-invalid={mapsInvalid}
            className="bg-secondary text-xs"
          />
          {mapsInvalid && <p className="mt-1 text-[11px] text-destructive">No parece un link de Google Maps.</p>}
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[10px] font-semibold tracking-[.06em] text-muted-foreground">CATEGORÍA</div>
        <div className="flex flex-wrap gap-[5px]">
          {tab === "activity"
            ? CAT_KEYS.map((key) => {
                const c = CATEGORIES[key];
                const active = actCat === key;
                return (
                  <Chip key={key} active={active} bg={c.bg} border={c.border} text={c.text} onClick={() => setActCat(key)}>
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: c.dot }} />{c.label}
                  </Chip>
                );
              })
            : Object.entries(TASK_CATEGORIES).map(([key, c]) => {
                const active = taskCat === key;
                return (
                  <Chip key={key} active={active} bg={c.bg} border={c.border} text={c.text} onClick={() => setTaskCat(key)}>
                    <span>{c.icon}</span>{c.label}
                  </Chip>
                );
              })}
        </div>
      </div>

      <div className="flex gap-3">
        {tab === "task" && (
          <div className="flex-1">
            <div className="mb-1.5 text-[10px] font-semibold tracking-[.06em] text-muted-foreground">PRIORIDAD</div>
            <div className="flex gap-1">
              {PRIORITY_ORDER.map((p) => {
                const active = priority === p;
                const pr = PRIORITIES[p];
                return (
                  <button key={p} onClick={() => setPriority(p)}
                    className={cn("flex-1 cursor-pointer rounded-md border py-2 text-[10.5px] font-semibold md:py-1", !active && "border-border bg-secondary text-muted-foreground")}
                    style={active ? { background: pr.bg, borderColor: pr.color, color: pr.color } : undefined}>
                    {pr.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className={tab === "task" ? "w-[116px]" : "w-full"}>
          <div className="mb-1.5 text-[10px] font-semibold tracking-[.06em] text-muted-foreground">DURACIÓN</div>
          <div className="flex gap-1">
            {DURATIONS.map((d) => {
              const active = dur === d;
              return (
                <button key={d} onClick={() => setDur(d)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-md border py-2 text-[10.5px] font-semibold md:py-1",
                    active ? "border-primary bg-primary/20 text-foreground" : "border-border bg-secondary text-muted-foreground",
                  )}>
                  {d === 0.5 ? "30m" : `${d}h`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-0.5 flex gap-1.5">
        <Button onClick={save} disabled={!canSave} className="flex-1 font-bold">
          {editing ? "✓ Guardar cambios" : tab === "activity" ? "✓ Agregar actividad" : "✓ Agregar tarea"}
        </Button>
        {editing && onDeleteTask && (
          <Button variant="outline" onClick={onDeleteTask} className="border-[#F09595] bg-[#FCEBEB] text-[#A32D2D] hover:bg-[#FCEBEB]/80 hover:text-[#A32D2D]">
            Eliminar
          </Button>
        )}
      </div>

      {tab === "activity" && !editing && (
        <div className="text-center text-[10px] leading-snug text-muted-foreground">
          Al guardar podrás ajustar horas, rangos y gastos en el panel.
        </div>
      )}
    </>
  );

  if (mobile) {
    return (
      <BottomSheet
        open
        onOpenChange={(open) => { if (!open) onClose(); }}
        title={editing ? "Editar tarea" : "Nueva en el calendario"}
      >
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground">{where}</div>
          {fields}
        </div>
      </BottomSheet>
    );
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />

      <div
        className="fixed z-[41] flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-[0_12px_40px_rgba(0,0,0,.28)]"
        style={{ left: Math.max(12, left), top: Math.max(12, top), width: W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">{where}</div>
          <button onClick={onClose} className="cursor-pointer text-base leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>
        {fields}
      </div>
    </>
  );
}

function TypeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 cursor-pointer items-center justify-center gap-[5px] rounded-lg border py-[7px] text-[12.5px] font-semibold",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground",
      )}
    >
      <span className="text-[13px]">{icon}</span> {label}
    </button>
  );
}

function Chip({ active, bg, border, text, onClick, children }: {
  active: boolean; bg: string; border: string; text: string;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex cursor-pointer items-center gap-1 rounded-full border-[1.5px] px-[9px] py-1.5 text-[11px] font-medium md:py-1", !active && "border-border bg-secondary text-muted-foreground")}
      style={active ? { background: bg, borderColor: border, color: text, boxShadow: `0 0 0 2px ${border}33` } : undefined}
    >
      {children}
    </button>
  );
}
