"use client";
import { useMemo } from "react";
import { ClipboardList, Clock, Loader2 } from "lucide-react";
import { PANEL } from "@/components/home/shared";
import { Disclosure } from "@/components/ui/disclosure";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { linkLabel } from "@/utils/linkify";
import { matchIdeasToPlan } from "@/utils/ideaPlan";
import type { TripPlace } from "@/utils/places";
import { fmtHour } from "@/utils/time";
import { cn } from "@/lib/utils";
import type { Day, Idea, IdeaLink } from "@/types";

interface IdeasByDayProps {
  ideas: Idea[];
  days: Day[];
  places: TripPlace[];
  loadingIds: Set<string>;     // ideas whose video is still being read
  planLinks?: IdeaLink[];
  planLinksAt?: string;
  planIdeaIds?: string[];      // ideas the last analysis read
}

// Read-only view: the itinerary as it is, with the ideas that fit each activity,
// free gap or day, and what to do before the trip. Nothing here changes the plan.
export default function IdeasByDay({ ideas, days, places, loadingIds, planLinks, planLinksAt, planIdeaIds }: IdeasByDayProps) {
  // Ideas still being read aren't placed yet: their text is about to change.
  const active = useMemo(
    () => ideas.filter((i) => i.status !== "discarded" && !loadingIds.has(i.id)),
    [ideas, loadingIds],
  );
  const reading = ideas.filter((i) => loadingIds.has(i.id));
  const rules = useMemo(() => matchIdeasToPlan(active, days, places), [active, days, places]);

  // Claude's analysis covers the ideas it actually read; the rest use the free
  // match. Analyses saved before the ids were recorded fall back to the linked ideas.
  const analyzedIds = new Set(planIdeaIds ?? (planLinks ?? []).map((l) => l.ideaId));
  const analyzed = (i: Idea) => !!planLinksAt && analyzedIds.has(i.id);
  // Links to activities removed from the plan since the analysis are dropped.
  const eventIds = new Set(days.flatMap((d) => d.events.map((e) => e.id)));
  const dayIds = new Set(days.map((d) => d.id));
  const links: IdeaLink[] = active.flatMap((i) => {
    if (analyzed(i)) return (planLinks ?? []).filter((l) => l.ideaId === i.id && dayIds.has(l.dayId) && (!l.eventId || eventIds.has(l.eventId)));
    const own = rules.filter((l) => l.ideaId === i.id);
    const events = own.filter((l) => l.eventId);
    return events.length ? events : own;
  });
  const linkedIds = new Set(links.map((l) => l.ideaId));
  const loose = active.filter((i) => !linkedIds.has(i.id));
  const byId = new Map(active.map((i) => [i.id, i]));
  const before = links.filter((l) => l.before);
  const forWhat = (l: IdeaLink) => {
    const day = days.find((d) => d.id === l.dayId);
    const ev = l.eventId ? day?.events.find((e) => e.id === l.eventId) : undefined;
    return [day?.label.split("·")[0].trim(), ev?.title ?? day?.sub].filter(Boolean).join(" · ");
  };

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

  return (
    <div className="flex flex-col gap-4">
      {readingPanel}
      <p className="text-[13px] leading-relaxed text-secondary-foreground">
        Tus ideas sobre el itinerario que ya tienen: qué hacer o probar en cada actividad y en los ratos libres. No cambia el plan.
      </p>

      {before.length > 0 && (
        <section className={PANEL}>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold"><ClipboardList className="size-4 text-emerald-700" />Antes del viaje</h2>
          <p className="text-[13px] text-muted-foreground">Qué comprar, reservar o decidir antes de salir</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {before.map((l) => <IdeaChip key={`${l.ideaId}-before`} idea={byId.get(l.ideaId)!} link={l} context={`Para ${forWhat(l)}`} />)}
          </ul>
        </section>
      )}

      {days.map((day) => {
        const dayLinks = links.filter((l) => l.dayId === day.id && !l.before);
        if (dayLinks.length === 0) return null;
        const [weekday, date] = day.label.split("·").map((s) => s.trim());
        const eventGroups = [...day.events]
          .sort((a, b) => a.start - b.start)
          .map((ev) => ({ key: ev.id, start: ev.start, title: ev.title, time: fmtHour(ev.start), items: dayLinks.filter((l) => l.eventId === ev.id) }));
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
                      : <><span className="w-[68px] shrink-0 tabular-nums text-muted-foreground">{g.time}</span><span className="font-medium">{g.title}</span></>}
                  </div>
                  <ul className="flex flex-col gap-1.5 md:pl-[76px]">
                    {g.items.map((l) => <IdeaChip key={`${l.ideaId}-${g.key}`} idea={byId.get(l.ideaId)!} link={l} />)}
                  </ul>
                </div>
              ))}
              {general.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[13px] font-medium text-secondary-foreground">Para el día</div>
                  <ul className="flex flex-col gap-1.5 md:pl-[76px]">
                    {general.map((l) => <IdeaChip key={l.ideaId} idea={byId.get(l.ideaId)!} link={l} />)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {loose.length > 0 && (
        <Disclosure title="Sin momento en el plan" hint={loose.length} className="border-b">
          <p className="mb-2 text-xs text-muted-foreground">
            No encontramos dónde encajan en este viaje. Prueba &quot;Analizar con Claude&quot; o asígnales un lugar en &quot;Por lugar&quot;.
          </p>
          <ul className="flex flex-col gap-1.5">
            {loose.map((i) => <IdeaChip key={i.id} idea={i} />)}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

function IdeaChip({ idea, link, context }: { idea: Idea; link?: IdeaLink; context?: string }) {
  const type = idea.cat ?? idea.suggestion?.cat;
  const t = type ? IDEA_TYPES[type] : undefined;
  const heading = idea.note || idea.title || linkLabel(idea.url);
  // A quoted phrase that is just the heading again adds nothing.
  const bare = (s: string) => s.replace(/[“”"…]/g, "").trim().toLowerCase();
  const reason = link?.reason && !bare(heading).includes(bare(link.reason)) ? link.reason : undefined;
  return (
    <li>
      <a
        href={idea.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-2.5 rounded-xl bg-secondary px-2.5 py-2 hover:bg-muted"
      >
        {idea.thumbnail
          // eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnails, not optimizable
          ? <img src={idea.thumbnail} alt="" className="h-11 w-8 shrink-0 rounded-md object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <span className="flex h-11 w-8 shrink-0 items-center justify-center rounded-md bg-card text-sm">{t?.icon ?? "💡"}</span>}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-[13px] font-medium text-foreground">{heading}</span>
          {context && <span className="block truncate text-xs font-medium text-emerald-700">{context}</span>}
          {reason && (
            <span className="mt-0.5 line-clamp-2 text-xs text-secondary-foreground">
              {link?.source === "claude" && <span className="mr-1 font-semibold text-emerald-700">✨</span>}
              {reason}
            </span>
          )}
          {!reason && t && <span className="text-xs text-muted-foreground">{t.icon} {t.label}</span>}
        </span>
      </a>
    </li>
  );
}
