"use client";
import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { DigestSection, HideButton, InsightLine, SaveSpotButton, SpotLine, ToTaskButton, VoteButton } from "@/components/ideas/DigestSection";
import { PANEL } from "@/components/home/shared";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { INSIGHT_KINDS } from "@/constants/insightKinds";
import { collectInsights, hasTaskFor, insightTask, momentGroups, tripGuideText, type DigestInsight, type DigestSpot, type ZoneDigest } from "@/utils/insights";
import { normalizeText } from "@/utils/ideas";
import { cn } from "@/lib/utils";
import type { Day, Idea, IdeaSpot, InsightLink, InsightKind, InsightState, Task } from "@/types";

interface IdeasDigestProps {
  ideas: Idea[];                       // every idea, split videos included
  zones: { key: string; title: string }[];
  zoneOf: (idea: Idea) => string;
  days: Day[];
  links?: InsightLink[];               // where "Analizar con Claude" placed each insight
  tasks?: Task[];
  voter: string;
  onAddTask?: (task: Pick<Task, "title" | "note" | "priority">) => void;
  onVote?: (ideaId: string, index: number) => void;
  onHide?: (ideaId: string, index: number, hidden: InsightState["hidden"]) => void;
  onSaveSpot?: (videoId: string, spot: IdeaSpot) => void;
  row: string;                         // class of a swipeable row of cards
  renderCard: (idea: Idea) => React.ReactNode;
  onOpen: (ideaId: string) => void;
}

// What one line can do: vote, hide or restore, and turn a todo into a task.
interface LineActions {
  voter: string;
  vote?: (i: DigestInsight) => void;
  hide?: (i: DigestInsight, hidden: InsightState["hidden"]) => void;
  toTask?: { has: (i: DigestInsight) => boolean; add: (i: DigestInsight) => void };
  spot?: { saved: (s: DigestSpot) => boolean; save: (s: DigestSpot) => void };
}

// "Lo que aportan los videos": per destination, everything its saved videos
// say, ready to use — what to do before, what to avoid, advice by moment of
// the trip, useful facts and places — with the videos last, as the source.
export default function IdeasDigest({
  ideas, zones, zoneOf, days, links, tasks = [], voter, onAddTask, onVote, onHide, onSaveSpot, row, renderCard, onOpen,
}: IdeasDigestProps) {
  const [copied, setCopied] = useState(false);
  const digests = collectInsights(ideas, zoneOf, links);
  // Destinations whose videos say something come first, each group in trip order.
  const useful = (d: ZoneDigest) => d.insights.length + d.spots.length > 0;
  const shown = zones
    .map((z) => ({ ...z, digest: digests.get(z.key) }))
    .filter((z): z is typeof z & { digest: ZoneDigest } => !!z.digest)
    .sort((a, b) => Number(useful(b.digest)) - Number(useful(a.digest)));
  const guide = tripGuideText(shown.map((z) => ({ title: z.title, zone: z.key, digest: z.digest })), days);
  const actions: LineActions = {
    voter,
    vote: onVote && ((i) => onVote(i.ideaId, i.index)),
    hide: onHide && ((i, hidden) => onHide(i.ideaId, i.index, hidden)),
    spot: onSaveSpot && {
      saved: (s) => ideas.some((i) => i.parentId === s.ideaId && normalizeText(i.spot?.name ?? "") === normalizeText(s.spot.name)),
      save: (s) => onSaveSpot(s.ideaId, s.spot),
    },
    toTask: onAddTask && {
      has: (i) => hasTaskFor(tasks, i),
      add: (i) => onAddTask(insightTask(i, ideas.find((v) => v.id === i.ideaId)?.url ?? "")),
    },
  };

  async function copyGuide() {
    try {
      await navigator.clipboard.writeText(guide);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {guide && (
        <Button variant="outline" onClick={copyGuide} className="h-9 gap-1.5 self-start rounded-full bg-card">
          <ClipboardCopy className="size-4" /> {copied ? "¡Guía copiada!" : "Copiar la guía del grupo"}
        </Button>
      )}
      {shown.map(({ key, title, digest }) => (
        <ZonePanel key={key} zone={key} title={title} digest={digest} days={days} row={row} renderCard={renderCard} onOpen={onOpen} actions={actions} />
      ))}
    </div>
  );
}

function ZonePanel({ zone, title, digest, days, row, renderCard, onOpen, actions }: {
  zone: string; title: string; digest: ZoneDigest; days: Day[]; row: string;
  renderCard: (idea: Idea) => React.ReactNode; onOpen: (ideaId: string) => void; actions: LineActions;
}) {
  const { voter, vote, hide, toTask, spot } = actions;
  // Hidden by the group, then Claude's verdict: covered by the plan or not for this trip, all last.
  const hidden = digest.insights.filter((i) => i.state?.hidden);
  const visible = digest.insights.filter((i) => !i.state?.hidden);
  const open = visible.filter((i) => !i.link || i.link.status === "new");
  const covered = visible.filter((i) => i.link?.status === "covered");
  const na = visible.filter((i) => i.link?.status === "na");
  const votes = (i: DigestInsight) => i.state?.votes?.length ?? 0;
  const of = (kind: InsightKind) => open.filter((i) => i.insight.kind === kind).sort((a, b) => votes(b) - votes(a));
  const todos = of("todo").sort((a, b) => (a.link?.deadline ?? "9").localeCompare(b.link?.deadline ?? "9"));
  const pendingTodos = toTask ? todos.filter((i) => !toTask.has(i)) : [];
  const avoid = of("avoid");
  const tips = momentGroups(of("tip"), days, zone);
  const facts = of("fact");
  const total = open.length + digest.spots.length;
  const videos = digest.videos.length;

  const line = (i: DigestInsight) => (
    <InsightLine
      key={i.id}
      item={i}
      onOpen={onOpen}
      action={(
        <>
          {i.insight.kind === "todo" && toTask && !i.state?.hidden && <ToTaskButton done={toTask.has(i)} onAdd={() => toTask.add(i)} />}
          {vote && !i.state?.hidden && <VoteButton count={votes(i)} mine={!!i.state?.votes?.includes(voter)} onToggle={() => vote(i)} />}
          {hide && <HideButton hidden={!!i.state?.hidden} onHide={() => hide(i, "dismissed")} onRestore={() => hide(i, undefined)} />}
        </>
      )}
    />
  );
  const lines = (items: DigestInsight[]) => items.map(line);

  return (
    <section className={cn(PANEL, "flex flex-col gap-3")}>
      <h2 className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[15px] font-semibold">📍 {title}</span>
        <span className="text-xs text-muted-foreground">
          {videos} {videos === 1 ? "video" : "videos"}{total > 0 && ` → ${total} ${total === 1 ? "dato útil" : "datos útiles"}`}
        </span>
      </h2>
      {total + covered.length + na.length + hidden.length === 0 && (
        <p className="text-[13px] text-muted-foreground">Estos videos aún no tienen consejos ni lugares analizados.</p>
      )}
      {todos.length > 0 && (
        <DigestSection title={`${INSIGHT_KINDS.todo.icon} Por hacer`} count={todos.length}>
          {lines(todos)}
          {toTask && pendingTodos.length > 1 && (
            <li>
              <button onClick={() => pendingTodos.forEach(toTask.add)} className="cursor-pointer px-1.5 py-1 text-xs font-medium text-emerald-800 hover:underline">
                Pasar las {pendingTodos.length} a Pendientes
              </button>
            </li>
          )}
        </DigestSection>
      )}
      {avoid.length > 0 && <DigestSection title={`${INSIGHT_KINDS.avoid.icon} Evitar`} count={avoid.length}>{lines(avoid)}</DigestSection>}
      {tips.length > 0 && (
        <DigestSection title="🕐 Consejos por momento" count={tips.reduce((n, g) => n + g.items.length, 0)}>
          {tips.map((g) => (
            <li key={g.key} className="flex flex-col">
              <span className="px-1.5 pt-1 text-xs font-medium text-muted-foreground">{g.label}</span>
              <ul>{lines(g.items)}</ul>
            </li>
          ))}
        </DigestSection>
      )}
      {facts.length > 0 && <DigestSection title={`${INSIGHT_KINDS.fact.icon} Datos`} count={facts.length}>{lines(facts)}</DigestSection>}
      {digest.spots.length > 0 && (
        <DigestSection title="📍 Lugares" count={digest.spots.length}>
          {digest.spots.map((s) => (
            <SpotLine key={s.spot.name} item={s} onOpen={onOpen} action={spot && <SaveSpotButton saved={spot.saved(s)} onSave={() => spot.save(s)} />} />
          ))}
        </DigestSection>
      )}
      {covered.length + na.length + hidden.length > 0 && (
        <div className="[&>details:last-child]:border-b">
          {covered.length > 0 && <Disclosure title="✔️ Ya están en el plan" hint={covered.length}><ul className="pb-2">{lines(covered)}</ul></Disclosure>}
          {na.length > 0 && <Disclosure title="🚫 No aplican a este viaje" hint={na.length}><ul className="pb-2">{lines(na)}</ul></Disclosure>}
          {hidden.length > 0 && <Disclosure title="🙈 Ocultos por el grupo" hint={hidden.length}><ul className="pb-2">{lines(hidden)}</ul></Disclosure>}
        </div>
      )}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold">🎬 Videos <span className="text-xs font-normal text-muted-foreground">{videos}</span></h3>
        <div className={row}>{digest.videos.map(renderCard)}</div>
      </section>
    </section>
  );
}
