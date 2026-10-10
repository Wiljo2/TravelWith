import { Play } from "lucide-react";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { fmtVideoTime } from "@/utils/ideaVideo";
import { fmtDeadline, insightMeta, type DigestInsight, type DigestSpot } from "@/utils/insights";

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

export function InsightLine({ item, onOpen }: { item: DigestInsight; onOpen: (ideaId: string) => void }) {
  const meta = insightMeta(item.insight);
  const deadline = item.link?.deadline;
  return (
    <li>
      <button onClick={() => onOpen(item.ideaId)} className={ROW}>
        <span className="min-w-0 flex-1">
          {item.insight.text}
          {deadline && <span className="ml-1.5 rounded bg-amber-100 px-1 text-xs font-medium text-amber-900">{fmtDeadline(deadline)}</span>}
          {meta && <span className="ml-1.5 text-xs text-muted-foreground">{meta}</span>}
          {item.link?.reason && <span className="block text-xs text-secondary-foreground">{item.link.reason}</span>}
        </span>
        <Source sources={item.sources} at={item.insight.at} />
      </button>
    </li>
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
