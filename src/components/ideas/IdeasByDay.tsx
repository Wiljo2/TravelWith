"use client";
import { useMemo, useState } from "react";
import { ClipboardList, Clock, Loader2, Play } from "lucide-react";
import { PANEL } from "@/components/home/shared";
import IdeaThumb from "@/components/ideas/IdeaThumb";
import DayStrip from "@/components/map/DayStrip";
import { Disclosure } from "@/components/ui/disclosure";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { linkLabel } from "@/utils/linkify";
import { fmtHour } from "@/utils/time";
import { eventIcon } from "@/utils/itemIcon";
import { cn } from "@/lib/utils";
import type { Day, Idea, IdeaLink } from "@/types";

interface IdeasByDayProps {
  ideas: Idea[];
  days: Day[];
  loadingIds: Set<string>;     // ideas whose video is still being read
  links: IdeaLink[];           // where each idea fits (see ideaLinks)
  roomCode: string;
  // Where the trip is now: during it, the strip opens on today.
  phase?: "before" | "during" | "after";
  todayIdx?: number;
  onOpen: (ideaId: string) => void;   // plays it in the idea viewer
}

type Pick = number | "before" | null;

// Read-only view: the itinerary as it is, with the ideas that fit each activity,
// free gap or day, and what to do before the trip, one day at a time (or all).
// Nothing here changes the plan.
export default function IdeasByDay({ ideas, days, loadingIds, links, roomCode, phase, todayIdx, onOpen }: IdeasByDayProps) {
  const chip = (idea: Idea, key: string, link?: IdeaLink, context?: string) => (
    <IdeaChip key={key} idea={idea} link={link} context={context} roomCode={roomCode} onOpen={() => onOpen(idea.id)} />
  );
  // Ideas still being read aren't placed yet: their text is about to change.
  const active = useMemo(
    () => ideas.filter((i) => i.status !== "discarded" && !loadingIds.has(i.id)),
    [ideas, loadingIds],
  );
  const reading = ideas.filter((i) => loadingIds.has(i.id));
  const linkedIds = new Set(links.map((l) => l.ideaId));
  const loose = active.filter((i) => !linkedIds.has(i.id));
  const byId = new Map(active.map((i) => [i.id, i]));
  const before = links.filter((l) => l.before);
  const forWhat = (l: IdeaLink) => {
    const day = days.find((d) => d.id === l.dayId);
    const ev = l.eventId ? day?.events.find((e) => e.id === l.eventId) : undefined;
    return [day?.label.split("·")[0].trim(), ev?.title ?? day?.sub].filter(Boolean).join(" · ");
  };

  const counts = days.map((d) => new Set(links.filter((l) => l.dayId === d.id && !l.before).map((l) => l.ideaId)).size);
  // Before the trip: what to prepare, else the first day with ideas; during it, today.
  const [pick, setPick] = useState<Pick>(() => {
    if (phase === "during" && todayIdx != null) return todayIdx;
    if (phase === "after") return null;
    if (before.length) return "before";
    const first = counts.findIndex((n) => n > 0);
    return first >= 0 ? first : null;
  });

  const readingPanel = reading.length > 0 && (
    <section className={cn(PANEL, "flex flex-col gap-2")} aria-live="polite">
      {reading.map((i) => (
        <div key={i.id} className="flex items-center gap-2.5 text-[13px]">
          <Loader2 className="size-4 shrink-0 animate-spin text-emerald-700" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Leyendo {i.platform === "tiktok" ? "el TikTok" : "el video"}…</span>
            <span className="block truncate text-xs text-muted-foreground">
              {i.note || linkLabel(i.url)} · lo ubicamos en el plan en cuanto termine
            </span>
          </span>
        </div>
      ))}
    </section>
  );

  if (active.length === 0) {
    if (readingPanel) return readingPanel;
    return <p className="py-6 text-center text-[13px] text-muted-foreground">Agrega ideas para verlas sobre tu itinerario.</p>;
  }

  const beforePanel = before.length > 0 && (
    <section className={PANEL}>
      <h2 className="flex items-center gap-1.5 text-[15px] font-semibold"><ClipboardList className="size-4 text-emerald-700" />Antes del viaje</h2>
      <p className="text-[13px] text-muted-foreground">Qué comprar, reservar o decidir antes de salir</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {before.map((l) => chip(byId.get(l.ideaId)!, `${l.ideaId}-before`, l, forWhat(l) ? `Para ${forWhat(l)}` : undefined))}
      </ul>
    </section>
  );

  const dayPanel = (day: Day) => {
    const dayLinks = links.filter((l) => l.dayId === day.id && !l.before);
    if (dayLinks.length === 0) return null;
    const [weekday, date] = day.label.split("·").map((s) => s.trim());
    const eventGroups = [...day.events]
      .sort((a, b) => a.start - b.start)
      .map((ev) => ({ key: ev.id, start: ev.start, icon: eventIcon(ev), title: ev.title, time: fmtHour(ev.start), items: dayLinks.filter((l) => l.eventId === ev.id) }));
    const slotGroups = dayLinks
      .filter((l) => !l.eventId && l.slot)
      .reduce<Record<string, IdeaLink[]>>((acc, l) => {
        const k = `${l.slot!.start}-${l.slot!.end}`;
        (acc[k] ??= []).push(l);
        return acc;
      }, {});
    const groups = [
      ...eventGroups.filter((g) => g.items.length),
      ...Object.entries(slotGroups).map(([k, items]) => ({
        key: `slot-${k}`, start: items[0].slot!.start, title: `Libre ${fmtHour(items[0].slot!.start)} – ${fmtHour(items[0].slot!.end)}`, time: "", items, free: true,
      })),
    ].sort((a, b) => a.start - b.start);
    const general = dayLinks.filter((l) => !l.eventId && !l.slot);

    return (
      <section key={day.id} className={PANEL}>
        <h2 className="text-[15px] font-semibold">{weekday} {date}</h2>
        {day.sub && <p className="text-[13px] text-muted-foreground">{day.sub}</p>}
        <div className="mt-3 flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-baseline gap-2 text-[13px]">
                {"free" in g
                  ? <span className="flex items-center gap-1.5 font-medium text-emerald-700"><Clock className="size-3.5" />{g.title}</span>
                  : <><span className="w-[60px] shrink-0 tabular-nums text-muted-foreground">{g.time}</span><span className="min-w-0 truncate font-medium">{"icon" in g && <span aria-hidden className="mr-1">{g.icon}</span>}{g.title}</span></>}
              </div>
              <ul className="flex flex-col gap-1.5 md:pl-[68px]">
                {g.items.map((l) => chip(byId.get(l.ideaId)!, `${l.ideaId}-${g.key}`, l))}
              </ul>
            </div>
          ))}
          {general.length > 0 && (
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-secondary-foreground">Para el día</div>
              <ul className="flex flex-col gap-1.5 md:pl-[68px]">
                {general.map((l) => chip(byId.get(l.ideaId)!, l.ideaId, l))}
              </ul>
            </div>
          )}
        </div>
      </section>
    );
  };

  const day = typeof pick === "number" ? days[pick] : undefined;
  return (
    <div className="flex flex-col gap-4">
      <DayStrip
        days={days}
        selected={typeof pick === "number" ? pick : null}
        onSelect={setPick}
        counts={counts}
        before={{ count: before.length, active: pick === "before", onSelect: () => setPick("before") }}
      />
      {readingPanel}

      {pick === "before" ? beforePanel
        : day ? dayPanel(day) ?? <p className="py-6 text-center text-[13px] text-muted-foreground">No hay ideas para este día.</p>
          : (
            <>
              {beforePanel}
              {days.map(dayPanel)}
              {loose.length > 0 && (
                <Disclosure title="Sin momento en el plan" hint={loose.length} className="border-b">
                  <p className="mb-2 text-xs text-muted-foreground">
                    No encontramos dónde encajan en este viaje. Prueba &quot;Analizar con Claude&quot;, o ábrelas y elige su momento en el plan.
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {loose.map((i) => chip(i, i.id))}
                  </ul>
                </Disclosure>
              )}
            </>
          )}
    </div>
  );
}

// An idea under its moment of the plan: its cover (tap to play), what it is and
// why it fits there.
function IdeaChip({ idea, link, context, roomCode, onOpen }: {
  idea: Idea; link?: IdeaLink; context?: string; roomCode: string; onOpen: () => void;
}) {
  const type = idea.cat ?? idea.suggestion?.cat;
  const t = type ? IDEA_TYPES[type] : undefined;
  const heading = idea.note || idea.title || linkLabel(idea.url);
  // A quoted phrase that is just the heading again adds nothing.
  const bare = (s: string) => s.replace(/[“”"…]/g, "").trim().toLowerCase();
  const reason = link?.reason && !bare(heading).includes(bare(link.reason)) ? link.reason : undefined;
  return (
    <li>
      <button onClick={onOpen} className="flex w-full cursor-pointer items-start gap-2.5 rounded-xl bg-secondary p-1.5 text-left hover:bg-muted">
        <span className="relative shrink-0">
          <IdeaThumb idea={idea} roomCode={roomCode} className="h-[68px] w-[40px] rounded-lg" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-5 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
              <Play className="size-2.5 fill-current" />
            </span>
          </span>
        </span>
        <span className="min-w-0 flex-1 py-0.5">
          <span className="line-clamp-1 text-[13px] font-semibold leading-snug text-foreground">{heading}</span>
          {context && <span className="mt-0.5 block truncate text-xs font-medium text-emerald-700">{context}</span>}
          {reason && (
            <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-secondary-foreground">
              {link?.source === "claude" && <span className="mr-1 font-semibold text-emerald-700">✨</span>}
              {reason}
            </span>
          )}
          {!reason && t && <span className="mt-1 block text-xs text-muted-foreground">{t.icon} {t.label}</span>}
        </span>
      </button>
    </li>
  );
}
