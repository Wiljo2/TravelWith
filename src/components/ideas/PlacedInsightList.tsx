import { Play } from "lucide-react";
import { INSIGHT_KINDS } from "@/constants/insightKinds";
import { fmtVideoTime } from "@/utils/ideaVideo";
import { fmtDeadline, insightMeta, type PlacedInsight } from "@/utils/insights";

// Advice from the group's videos where it's used (an activity, today): what to
// do, when, why, and a link to the second of the video that says it.
export default function PlacedInsightList({ items }: { items: PlacedInsight[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map(({ id, insight, idea, link }) => {
        const meta = [insightMeta(insight), link.deadline && fmtDeadline(link.deadline)].filter(Boolean).join(" · ");
        return (
          <li key={id} className="flex gap-2 text-[13px] leading-snug">
            <span aria-hidden className="shrink-0">{INSIGHT_KINDS[insight.kind].icon}</span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground">{insight.text}</span>
              {meta && <span className="ml-1.5 text-xs text-muted-foreground">{meta}</span>}
              {link.reason && <span className="block text-xs text-secondary-foreground">{link.reason}</span>}
            </span>
            <a
              href={idea.url}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-0.5 self-start text-xs text-muted-foreground hover:text-foreground"
              aria-label="Ver el video"
            >
              <Play className="size-3" />{insight.at !== undefined ? fmtVideoTime(insight.at) : "video"}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
