import {
  CalendarClock,
  Download,
  Lightbulb,
  ListChecks,
  MapPinned,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: CalendarClock,
    title: "Itinerario hora por hora",
    description: "Calendario con arrastrar y soltar, categorías de colores y actividades de varios días.",
  },
  {
    icon: MapPinned,
    title: "Mapa y modo offline",
    description: "Cada actividad en el mapa, lugares cercanos y el viaje disponible sin internet, incluso en migración.",
  },
  {
    icon: Lightbulb,
    title: "Tablero de ideas",
    description: "Guarda links de TikTok, Instagram y YouTube; Claude los organiza por lugar y momento.",
  },
  {
    icon: Wallet,
    title: "Presupuesto compartido",
    description: "Gastos por grupo o por persona, conversión USD↔COP y total por viajero.",
  },
  {
    icon: ListChecks,
    title: "Pendientes y decisiones",
    description: "Tareas con prioridad; elige entre opciones (hotel A o B) y se convierte en evento + gasto.",
  },
  {
    icon: Sparkles,
    title: "Asistente con IA",
    description: "Pídele cambios en lenguaje natural; tú apruebas cada cambio antes de que se aplique.",
  },
  {
    icon: Users,
    title: "Colaboración en tiempo real",
    description: "Todos ven los cambios al instante, se unen con un código y hay historial de quién cambió qué.",
  },
  {
    icon: Download,
    title: "Exporta y llévalo contigo",
    description: "PDF del itinerario y app instalable en el celular.",
  },
];

export function Features() {
  return (
    <section id="funciones" className="scroll-mt-14 bg-muted/50 py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-2xl md:mb-14">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Todo lo que necesita tu viaje</h2>
          <p className="mt-3 text-muted-foreground">
            Una sola herramienta para organizar, decidir y gastar juntos.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex">
              <Card className="w-full rounded-2xl">
                <CardHeader className="gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <CardTitle>
                    <h3>{title}</h3>
                  </CardTitle>
                  <CardDescription className="leading-relaxed">{description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
