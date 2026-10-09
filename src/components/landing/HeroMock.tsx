const EVENTS = [
  { time: "08:00", label: "✈️ Vuelo a Cartagena", className: "border-l-[var(--chart-2)] bg-[var(--chart-2)]/15" },
  { time: "11:30", label: "🏖️ Playa Blanca", className: "border-l-[var(--chart-4)] bg-[var(--chart-4)]/15" },
  { time: "20:00", label: "🍽️ Cena en el centro", className: "border-l-[var(--chart-3)] bg-[var(--chart-3)]/15" },
];

const PEOPLE = [
  { initial: "A", className: "bg-[var(--chart-1)]" },
  { initial: "M", className: "bg-[var(--chart-2)]" },
  { initial: "S", className: "bg-[var(--chart-5)]" },
];

export function HeroMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-accent/70 blur-2xl" />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Sábado 14</p>
            <p className="text-base font-semibold">Cartagena, Colombia</p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">$420 por persona</span>
        </div>
        <ul className="flex flex-col gap-3">
          {EVENTS.map((e) => (
            <li key={e.time} className="flex items-stretch gap-3">
              <span className="w-11 shrink-0 pt-3 text-xs tabular-nums text-muted-foreground">{e.time}</span>
              <div className={`flex-1 rounded-lg border-l-4 px-3 py-3 text-sm font-medium ${e.className}`}>
                {e.label}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
          <div className="flex -space-x-2">
            {PEOPLE.map((p) => (
              <span
                key={p.initial}
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card ${p.className}`}
              >
                {p.initial}
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-[var(--chart-1)]" />
            3 personas editando ahora
          </span>
        </div>
      </div>
    </div>
  );
}
