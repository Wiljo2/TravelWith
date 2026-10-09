import { Sparkles } from "lucide-react";

export function AssistantShowcase() {
  return (
    <section className="bg-accent/60 py-16 md:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3.5" aria-hidden />
            Asistente con IA
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Pídelo como se lo pedirías a un amigo
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Escribe lo que quieres cambiar y el asistente propone los ajustes al itinerario, el
            presupuesto o los pendientes. Nada se aplica hasta que tú lo apruebas.
          </p>
        </div>
        <div aria-hidden className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-5">
          <div className="ml-8 rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            Agrega una cena el sábado a las 8pm y divide $120 entre todos
          </div>
          <div className="mr-8 rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm">
            Listo, esto es lo que propongo. Revisa y aprueba:
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <ul className="flex flex-col gap-2 text-sm">
              <li className="rounded-lg bg-[var(--chart-2)]/15 px-3 py-2">Crear evento &lsquo;Cena&rsquo; · Sábado 20:00</li>
              <li className="rounded-lg bg-[var(--chart-4)]/15 px-3 py-2">Agregar gasto $120 · por grupo</li>
            </ul>
            <div className="mt-3 flex gap-2">
              <span className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground">
                Aprobar (2)
              </span>
              <span className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-medium">
                Rechazar
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
