const STEPS = [
  { title: "Crea tu viaje", description: "Elige el destino y las fechas. Listo en menos de un minuto." },
  { title: "Invita con un código", description: "Comparte el código del viaje y tus amigos se unen al instante." },
  { title: "Planeen juntos", description: "Itinerario, gastos y pendientes se actualizan en vivo para todos." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto w-full max-w-6xl scroll-mt-14 px-4 py-16 sm:px-6 md:py-24">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Cómo funciona</h2>
      <ol className="mt-10 grid gap-6 md:mt-14 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-border bg-card p-6">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
