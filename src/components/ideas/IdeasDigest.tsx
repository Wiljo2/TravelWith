"use client";
import { DigestSection, InsightLine, SpotLine } from "@/components/ideas/DigestSection";
import { PANEL } from "@/components/home/shared";
import { INSIGHT_KINDS } from "@/constants/insightKinds";
import { byMoment, collectInsights, momentLabel, type ZoneDigest } from "@/utils/insights";
import { cn } from "@/lib/utils";
import type { Idea } from "@/types";

interface IdeasDigestProps {
  ideas: Idea[];                       // every idea, split videos included
  zones: { key: string; title: string }[];
  zoneOf: (idea: Idea) => string;
  row: string;                         // class of a swipeable row of cards
  renderCard: (idea: Idea) => React.ReactNode;
  onOpen: (ideaId: string) => void;
}

// "Lo que aportan los videos": per destination, everything its saved videos
// say, ready to use — what to do before, what to avoid, advice by moment of
// the trip, useful facts and places — with the videos last, as the source.
export default function IdeasDigest({ ideas, zones, zoneOf, row, renderCard, onOpen }: IdeasDigestProps) {
  const digests = collectInsights(ideas, zoneOf);
  // Destinations whose videos say something come first, each group in trip order.
  const useful = (d: ZoneDigest) => d.insights.length + d.spots.length > 0;
  const shown = zones
    .map((z) => ({ ...z, digest: digests.get(z.key) }))
    .filter((z): z is typeof z & { digest: ZoneDigest } => !!z.digest)
    .sort((a, b) => Number(useful(b.digest)) - Number(useful(a.digest)));
  return (
    <div className="flex flex-col gap-4">
      {shown.map(({ key, title, digest }) => (
        <ZonePanel key={key} zone={key} title={title} digest={digest} row={row} renderCard={renderCard} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ZonePanel({ zone, title, digest, row, renderCard, onOpen }: {
  zone: string; title: string; digest: ZoneDigest; row: string;
  renderCard: (idea: Idea) => React.ReactNode; onOpen: (ideaId: string) => void;
}) {
  const of = (kind: keyof typeof INSIGHT_KINDS) => digest.insights.filter((i) => i.insight.kind === kind);
  const todos = of("todo");
  const avoid = of("avoid");
  const tips = byMoment(of("tip"));
  const facts = of("fact");
  const total = digest.insights.length + digest.spots.length;
  const videos = digest.videos.length;
  return (
    <section className={cn(PANEL, "flex flex-col gap-3")}>
      <h2 className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[15px] font-semibold">📍 {title}</span>
        <span className="text-xs text-muted-foreground">
          {videos} {videos === 1 ? "video" : "videos"}{total > 0 && ` → ${total} ${total === 1 ? "dato útil" : "datos útiles"}`}
        </span>
      </h2>
      {total === 0 && <p className="text-[13px] text-muted-foreground">Estos videos aún no tienen consejos ni lugares analizados.</p>}
      {todos.length > 0 && (
        <DigestSection title={`${INSIGHT_KINDS.todo.icon} Por hacer`} count={todos.length}>
          {todos.map((i) => <InsightLine key={i.id} item={i} onOpen={onOpen} />)}
        </DigestSection>
      )}
      {avoid.length > 0 && (
        <DigestSection title={`${INSIGHT_KINDS.avoid.icon} Evitar`} count={avoid.length}>
          {avoid.map((i) => <InsightLine key={i.id} item={i} onOpen={onOpen} />)}
        </DigestSection>
      )}
      {tips.length > 0 && (
        <DigestSection title="🕐 Consejos por momento" count={tips.reduce((n, g) => n + g.items.length, 0)}>
          {tips.map((g) => (
            <li key={g.phase} className="flex flex-col">
              <span className="px-1.5 pt-1 text-xs font-medium text-muted-foreground">{momentLabel(g.phase, zone)}</span>
              <ul>{g.items.map((i) => <InsightLine key={i.id} item={i} onOpen={onOpen} />)}</ul>
            </li>
          ))}
        </DigestSection>
      )}
      {facts.length > 0 && (
        <DigestSection title={`${INSIGHT_KINDS.fact.icon} Datos`} count={facts.length}>
          {facts.map((i) => <InsightLine key={i.id} item={i} onOpen={onOpen} />)}
        </DigestSection>
      )}
      {digest.spots.length > 0 && (
        <DigestSection title="📍 Lugares" count={digest.spots.length}>
          {digest.spots.map((s) => <SpotLine key={s.spot.name} item={s} onOpen={onOpen} />)}
        </DigestSection>
      )}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold">🎬 Videos <span className="text-xs font-normal text-muted-foreground">{videos}</span></h3>
        <div className={row}>{digest.videos.map(renderCard)}</div>
      </section>
    </section>
  );
}
