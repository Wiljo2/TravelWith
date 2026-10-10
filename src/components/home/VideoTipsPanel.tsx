import PlacedInsightList from "@/components/ideas/PlacedInsightList";
import { PANEL, SectionTitle } from "@/components/home/shared";
import type { PlacedInsight } from "@/utils/insights";
import type { Day } from "@/types";

const SHOWN = 5;

// The group's video advice at the moment it's useful: before the trip, what to
// do ahead (closest deadline first); during it, today's advice in hour order.
export default function VideoTipsPanel({ placed, days, today, onOpenIdeas }: {
  placed: PlacedInsight[];
  days: Day[];
  today?: Day;             // set while the trip is underway
  onOpenIdeas: () => void;
}) {
  const startOf = (p: PlacedInsight) =>
    p.insight.start ?? p.link.slot?.start ?? days.find((d) => d.id === p.link.dayId)?.events.find((e) => e.id === p.link.eventId)?.start ?? 99;
  const items = today
    ? placed.filter((p) => p.link.dayId === today.id && !p.link.before).sort((a, b) => startOf(a) - startOf(b))
    : placed.filter((p) => p.link.before || p.insight.kind === "todo")
      .sort((a, b) => (a.link.deadline ?? "9").localeCompare(b.link.deadline ?? "9"));
  if (items.length === 0) return null;
  return (
    <section className={PANEL}>
      <SectionTitle
        title={today ? "💡 Consejos para hoy" : "✅ Antes del viaje"}
        count={items.length}
        action={items.length > SHOWN ? "Ver todos" : "Ideas"}
        onAction={onOpenIdeas}
      />
      <PlacedInsightList items={items.slice(0, SHOWN)} />
    </section>
  );
}
