import { INSIGHT_KINDS, INSIGHT_KIND_ORDER } from "@/constants/insightKinds";
import { fmtVideoTime } from "@/utils/ideaVideo";
import { insightMeta } from "@/utils/insights";
import type { IdeaInsight } from "@/types";

// The concrete advice of a video, grouped by what to do with it: todos and
// warnings first. Each line says when it matters and where the video says it.
export default function InsightList({ insights }: { insights: IdeaInsight[] }) {
  const groups = INSIGHT_KIND_ORDER
    .map((kind) => ({ kind, items: insights.filter((i) => i.kind === kind) }))
    .filter((g) => g.items.length > 0);
  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ kind, items }) => (
        <section key={kind} className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-muted-foreground">{INSIGHT_KINDS[kind].icon} {INSIGHT_KINDS[kind].plural}</h3>
          <ul className="flex flex-col gap-1">
            {items.map((i) => {
              const meta = insightMeta(i);
              return (
                <li key={i.text} className="leading-snug">
                  <span className="text-foreground">{i.text}</span>
                  {(meta || i.at !== undefined) && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {[meta, i.at !== undefined && `▶ ${fmtVideoTime(i.at)}`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
