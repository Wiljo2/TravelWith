import { Check, ListPlus, Play, ThumbsUp, Undo2, X } from "lucide-react";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { fmtVideoTime } from "@/utils/ideaVideo";
import { fmtDeadline, insightMeta, type DigestInsight, type DigestSpot } from "@/utils/insights";
import { cn } from "@/lib/utils";

// A titled list of a destination's digest ("✅ Por hacer", "📍 Lugares").
export function DigestSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="flex items-baseline gap-1.5 text-[13px] font-semibold">
        {title} <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </h3>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

// Where the advice comes from: how many videos say it, or the second of the one that does.
function Source({ sources, at }: { sources: string[]; at?: number }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
      <Play className="size-3" />
      {sources.length > 1 ? `${sources.length} videos` : at !== undefined ? fmtVideoTime(at) : "video"}
    </span>
  );
}

const ROW = "flex w-full cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1.5 text-left text-[13px] leading-snug hover:bg-secondary";

export function InsightLine({ item, onOpen, action }: {
  item: DigestInsight;
  onOpen: (ideaId: string) => void;
  action?: React.ReactNode;   // e.g. "pasar a pendientes", next to the line
}) {
  const meta = insightMeta(item.insight);
  const deadline = item.link?.deadline;
  return (
    <li className="flex items-start gap-1">
      <button onClick={() => onOpen(item.ideaId)} className={cn(ROW, "min-w-0 flex-1")}>
        <span className="min-w-0 flex-1">
          {item.insight.text}
          {deadline && <span className="ml-1.5 rounded bg-amber-100 px-1 text-xs font-medium text-amber-900">{fmtDeadline(deadline)}</span>}
          {meta && <span className="ml-1.5 text-xs text-muted-foreground">{meta}</span>}
          {item.link?.reason && <span className="block text-xs text-secondary-foreground">{item.link.reason}</span>}
          {item.conflicts?.map((c) => (
            <span key={c} className="block text-xs text-amber-900">⚠️ Otro video dice lo contrario: {c}</span>
          ))}
        </span>
        <Source sources={item.sources} at={item.insight.at} />
      </button>
      {action}
    </li>
  );
}

// Turns a todo into a task of the group, or says it already is one.
export function ToTaskButton({ done, onAdd }: { done: boolean; onAdd: () => void }) {
  if (done) {
    return <span title="Ya está en Pendientes" className="flex size-8 shrink-0 items-center justify-center text-emerald-700"><Check className="size-4" /></span>;
  }
  return (
    <button
      onClick={onAdd}
      title="Pasar a Pendientes"
      aria-label="Pasar a Pendientes"
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      <ListPlus className="size-4" />
    </button>
  );
}

export function SpotLine({ item, onOpen }: { item: DigestSpot; onOpen: (ideaId: string) => void }) {
  const t = item.spot.cat ? IDEA_TYPES[item.spot.cat] : undefined;
  const meta = [item.spot.price, item.spot.tip].filter(Boolean).join(" · ");
  return (
    <li>
      <button onClick={() => onOpen(item.ideaId)} className={ROW}>
        <span className="min-w-0 flex-1">
          {t && <span className="mr-1">{t.icon}</span>}
          <span className="font-medium">{item.spot.name}</span>
          {meta && <span className="ml-1.5 text-xs text-muted-foreground">{meta}</span>}
        </span>
        <Source sources={item.sources} at={item.spot.at} />
      </button>
    </li>
  );
}

const ICON_BTN = "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-lg px-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground";

// "Me sirve": the group's votes on one piece of advice.
export function VoteButton({ count, mine, onToggle }: { count: number; mine: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={mine}
      title={mine ? "Quitar mi voto" : "Me sirve"}
      className={cn(ICON_BTN, mine && "font-semibold text-emerald-800")}
    >
      <ThumbsUp className={cn("size-3.5", mine && "fill-current")} />{count > 0 && count}
    </button>
  );
}

// Hides advice the group already knew or doesn't want; restores it when hidden.
export function HideButton({ hidden, onHide, onRestore }: { hidden: boolean; onHide: () => void; onRestore: () => void }) {
  return hidden ? (
    <button onClick={onRestore} title="Volver a mostrar" className={ICON_BTN}><Undo2 className="size-3.5" /></button>
  ) : (
    <button onClick={onHide} title="Ocultar (ya lo sabíamos o no sirve)" aria-label="Ocultar" className={ICON_BTN}><X className="size-3.5" /></button>
  );
}
