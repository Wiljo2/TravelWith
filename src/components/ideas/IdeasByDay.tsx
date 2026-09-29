"use client";
import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, Sparkles } from "lucide-react";
import { PANEL } from "@/components/home/shared";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { isModelCached, matchEventsWithAI } from "@/lib/ideaAI";
import { linkLabel } from "@/utils/linkify";
import { matchIdeasToPlan } from "@/utils/ideaPlan";
import { findPlace, type TripPlace } from "@/utils/places";
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
  // Runs "Analizar con Claude" on the server (only `ideaIds` when given).
  onAnalyze: (ideaIds?: string[]) => Promise<{ links: IdeaLink[]; at: string }>;
  onSavePlan: (links: IdeaLink[], at: string) => void;
}

// Read-only view: the itinerary as it is, with the ideas that fit each activity,
// free gap or day. Nothing here changes the plan.
export default function IdeasByDay({ ideas, days, places, loadingIds, planLinks, planLinksAt, onAnalyze, onSavePlan }: IdeasByDayProps) {
  // Ideas still being read aren't placed yet: their text is about to change.
  const active = useMemo(
    () => ideas.filter((i) => i.status !== "discarded" && !loadingIds.has(i.id)),
    [ideas, loadingIds],
  );
  const reading = ideas.filter((i) => loadingIds.has(i.id));
  const rules = useMemo(() => matchIdeasToPlan(active, days, places), [active, days, places]);
  const [aiLinks, setAiLinks] = useState<IdeaLink[]>([]);
  const [claude, setClaude] = useState<"idle" | "running" | { error: string }>("idle");

  // Free model pass for ideas the rules couldn't tie to an activity — only when
  // it's already downloaded (no surprise 118 MB on a phone).
  const unmatched = useMemo(
    () => active.filter((i) => !rules.some((l) => l.ideaId === i.id && l.eventId)),
    [active, rules],
  );
  const unmatchedKey = unmatched.map((i) => `${i.id}:${i.note ?? ""}:${i.transcript?.length ?? 0}`).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (unmatched.length === 0 || !(await isModelCached())) return;
      const allowed = (i: Idea) => findPlace(places, i.place ?? i.suggestion?.place)?.dayIds ?? null;
      const links = await matchEventsWithAI(unmatched, days, allowed, () => {}).catch(() => []);
      if (!cancelled) setAiLinks(links);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when unmatched ideas change
  }, [unmatchedKey, days]);

  // Claude's analysis covers the ideas that existed when it ran; newer ones use the free match.
  const analyzed = (i: Idea) => !!planLinksAt && i.createdAt <= planLinksAt;
  const fresh = planLinksAt ? active.filter((i) => !analyzed(i)) : [];
  const newSinceAnalysis = fresh.length;
  // Links to activities removed from the plan since the analysis are dropped.
  const eventIds = new Set(days.flatMap((d) => d.events.map((e) => e.id)));
  const links: IdeaLink[] = active.flatMap((i) => {
    if (analyzed(i)) return (planLinks ?? []).filter((l) => l.ideaId === i.id && (!l.eventId || eventIds.has(l.eventId)));
    const own = rules.filter((l) => l.ideaId === i.id);
    const events = own.filter((l) => l.eventId);
    if (events.length) return events;
    const ai = aiLinks.filter((l) => l.ideaId === i.id);
    return ai.length ? ai : own;
  });
  const linkedIds = new Set(links.map((l) => l.ideaId));
  const loose = active.filter((i) => !linkedIds.has(i.id));
  const byId = new Map(active.map((i) => [i.id, i]));

  // With a previous analysis, only the new ideas are sent (cheaper); the rest
  // keep their links. "Todo de nuevo" re-reads everything (e.g. after plan changes).
  async function analyze(onlyNew: boolean) {
    setClaude("running");
    try {
      const ids = onlyNew ? fresh.map((i) => i.id) : undefined;
      const { links: next, at } = await onAnalyze(ids);
      const kept = ids ? (planLinks ?? []).filter((l) => !ids.includes(l.ideaId)) : [];
      onSavePlan([...kept, ...next], at);
      setClaude("idle");
    } catch (e) {
      setClaude({ error: e instanceof Error ? e.message : "No se pudo analizar" });
    }
  }

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
      <section className={cn(PANEL, "flex flex-col gap-3 bg-linear-to-br from-accent to-card md:flex-row md:items-center")}>
        <p className="flex-1 text-[13px] leading-relaxed text-secondary-foreground">
          Tus ideas sobre el itinerario que ya tienen: qué hacer o probar en cada actividad y en los ratos libres.
          {" "}No cambia el plan.
          {planLinksAt && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Analizado con Claude el {new Date(planLinksAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {newSinceAnalysis > 0 && ` · ${newSinceAnalysis} ${newSinceAnalysis === 1 ? "idea nueva" : "ideas nuevas"} sin analizar`}
            </span>
          )}
        </p>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <Button onClick={() => analyze(newSinceAnalysis > 0)} disabled={claude === "running"} className="h-9 gap-1.5 rounded-full px-4 font-semibold">
            {claude === "running" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {claude === "running" ? "Analizando…"
              : newSinceAnalysis > 0 ? `Analizar ${newSinceAnalysis === 1 ? "la nueva" : `las ${newSinceAnalysis} nuevas`}`
              : planLinksAt ? "Analizar de nuevo" : "Analizar con Claude"}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {newSinceAnalysis > 0 ? "Solo las nuevas · menos de 1 centavo" : "Más preciso y explica el porqué · ~1 centavo"}
            {newSinceAnalysis > 0 && claude !== "running" && (
              <> · <button onClick={() => analyze(false)} className="cursor-pointer underline underline-offset-2 hover:text-foreground">todo de nuevo</button></>
            )}
          </span>
          {typeof claude === "object" && <span className="text-xs text-destructive">{claude.error}</span>}
        </div>
      </section>

      {days.map((day) => {
        const dayLinks = links.filter((l) => l.dayId === day.id);
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
            No encontramos dónde encajan. Asígnales un lugar en &quot;Por lugar&quot; o prueba &quot;Analizar con Claude&quot;.
          </p>
          <ul className="flex flex-col gap-1.5">
            {loose.map((i) => <IdeaChip key={i.id} idea={i} />)}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

function IdeaChip({ idea, link }: { idea: Idea; link?: IdeaLink }) {
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
