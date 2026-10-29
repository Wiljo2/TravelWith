import { TRAVELERS } from "@/components/landing/globe/trip";
import { cn } from "@/lib/utils";

const EVENTS = [
  { time: "08:00", label: "✈️ Vuelo a Cartagena", className: "border-l-[var(--chart-2)] bg-[var(--chart-2)]/15" },
  { time: "11:30", label: "🏖️ Playa Blanca", className: "border-l-[var(--chart-4)] bg-[var(--chart-4)]/15" },
  { time: "20:00", label: "🍽️ Cena en el centro", className: "border-l-[var(--chart-3)] bg-[var(--chart-3)]/15" },
];

export function HeroMock({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("motion-safe:animate-float", className)}>
      <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Sábado 14</p>
            <p className="text-base font-semibold">Cartagena, Colombia</p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">$420 por persona</span>
        </div>
        <ul className="flex flex-col gap-2">
          {EVENTS.map((e) => (
            <li key={e.time} className="flex items-stretch gap-3">
              <span className="w-10 shrink-0 pt-2.5 text-xs text-muted-foreground tabular-nums">{e.time}</span>
              <div className={`flex-1 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium ${e.className}`}>
                {e.label}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
          <div className="flex -space-x-2">
            {TRAVELERS.map((t) => (
              <span
                key={t.initial}
                className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card"
                style={{ backgroundColor: `var(${t.color})` }}
              >
                {t.initial}
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-[var(--chart-1)] motion-safe:animate-pulse" />
            {TRAVELERS.length} personas editando ahora
          </span>
        </div>
      </div>
    </div>
  );
}
