"use client";
import { DigestSection, InsightLine, SpotLine } from "@/components/ideas/DigestSection";
import { PANEL } from "@/components/home/shared";
import { Disclosure } from "@/components/ui/disclosure";
import { INSIGHT_KINDS } from "@/constants/insightKinds";
import { collectInsights, momentGroups, type DigestInsight, type ZoneDigest } from "@/utils/insights";
import { cn } from "@/lib/utils";
import type { Day, Idea, InsightLink, InsightKind } from "@/types";

interface IdeasDigestProps {
  ideas: Idea[];                       // every idea, split videos included
  zones: { key: string; title: string }[];
  zoneOf: (idea: Idea) => string;
  days: Day[];
  links?: InsightLink[];               // where "Analizar con Claude" placed each insight
  row: string;                         // class of a swipeable row of cards
  renderCard: (idea: Idea) => React.ReactNode;
  onOpen: (ideaId: string) => void;
}

// "Lo que aportan los videos": per destination, everything its saved videos
// say, ready to use — what to do before, what to avoid, advice by moment of
// the trip, useful facts and places — with the videos last, as the source.
export default function IdeasDigest({ ideas, zones, zoneOf, days, links, row, renderCard, onOpen }: IdeasDigestProps) {
  const digests = collectInsights(ideas, zoneOf, links);
  // Destinations whose videos say something come first, each group in trip order.
  const useful = (d: ZoneDigest) => d.insights.length + d.spots.length > 0;
  const shown = zones
    .map((z) => ({ ...z, digest: digests.get(z.key) }))
    .filter((z): z is typeof z & { digest: ZoneDigest } => !!z.digest)
    .sort((a, b) => Number(useful(b.digest)) - Number(useful(a.digest)));
  return (
    <div className="flex flex-col gap-4">
      {shown.map(({ key, title, digest }) => (
        <ZonePanel key={key} zone={key} title={title} digest={digest} days={days} row={row} renderCard={renderCard} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ZonePanel({ zone, title, digest, days, row, renderCard, onOpen }: {
  zone: string; title: string; digest: ZoneDigest; days: Day[]; row: string;
  renderCard: (idea: Idea) => React.ReactNode; onOpen: (ideaId: string) => void;
}) {
  // Claude's verdict: what the plan already has, and what isn't for this trip, go last.
  const open = digest.insights.filter((i) => !i.link || i.link.status === "new");
  const covered = digest.insights.filter((i) => i.link?.status === "covered");
  const na = digest.insights.filter((i) => i.link?.status === "na");
  const of = (kind: InsightKind) => open.filter((i) => i.insight.kind === kind);
  const todos = of("todo").sort((a, b) => (a.link?.deadline ?? "9").localeCompare(b.link?.deadline ?? "9"));
  const avoid = of("avoid");
  const tips = momentGroups(of("tip"), days, zone);
  const facts = of("fact");
  const total = open.length + digest.spots.length;
  const videos = digest.videos.length;
  const lines = (items: DigestInsight[]) => items.map((i) => <InsightLine key={i.id} item={i} onOpen={onOpen} />);
  return (
    <section className={cn(PANEL, "flex flex-col gap-3")}>
      <h2 className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[15px] font-semibold">📍 {title}</span>
        <span className="text-xs text-muted-foreground">
          {videos} {videos === 1 ? "video" : "videos"}{total > 0 && ` → ${total} ${total === 1 ? "dato útil" : "datos útiles"}`}
        </span>
      </h2>
      {total + covered.length + na.length === 0 && (
        <p className="text-[13px] text-muted-foreground">Estos videos aún no tienen consejos ni lugares analizados.</p>
      )}
      {todos.length > 0 && <DigestSection title={`${INSIGHT_KINDS.todo.icon} Por hacer`} count={todos.length}>{lines(todos)}</DigestSection>}
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
          {digest.spots.map((s) => <SpotLine key={s.spot.name} item={s} onOpen={onOpen} />)}
        </DigestSection>
      )}
      {(covered.length > 0 || na.length > 0) && (
        <div>
          {covered.length > 0 && (
            <Disclosure title="✔️ Ya están en el plan" hint={covered.length} className={na.length ? "" : "border-b"}>
              <ul className="pb-2">{lines(covered)}</ul>
            </Disclosure>
          )}
          {na.length > 0 && (
            <Disclosure title="🚫 No aplican a este viaje" hint={na.length} className="border-b">
              <ul className="pb-2">{lines(na)}</ul>
            </Disclosure>
          )}
        </div>
      )}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold">🎬 Videos <span className="text-xs font-normal text-muted-foreground">{videos}</span></h3>
        <div className={row}>{digest.videos.map(renderCard)}</div>
      </section>
    </section>
  );
}
