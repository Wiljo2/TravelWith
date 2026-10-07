"use client";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import DayAgenda from "@/components/itinerary/DayAgenda";
import TodayCard from "@/components/home/TodayCard";
import { PANEL, SectionTitle } from "@/components/home/shared";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT } from "@/constants/taskCategories";
import { fmtUSD, optionGroupUSD, fmtUSDNum } from "@/utils/currency";
import { fmtHour } from "@/utils/time";
import { tripPhase } from "@/utils/tripDays";
import type { TripPhase } from "@/utils/tripDays";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import type { Day, Idea, Task, TripInfo } from "@/types";
import type { Tab } from "@/components/TabBar";

interface HomeViewProps {
  trip: TripInfo | null;
  days: Day[];
  tasks: Task[];
  ideas: Idea[];
  grandTotal: number;
  people: number;
  exchangeRate: number;
  onNavigate: (tab: Tab) => void;
  documents?: ReactNode;
}

function heroCopy(phase: TripPhase | null, dayCount: number) {
  if (phase?.phase === "before") {
    return phase.daysLeft === 1
      ? { big: "Mañana", small: "empieza el viaje" }
      : { big: `${phase.daysLeft} días`, small: "para el viaje" };
  }
  if (phase?.phase === "after") return { big: "¡Viaje terminado!", small: "Así quedó todo" };
  return { big: `${dayCount} días`, small: "de viaje" };
}

// Adapts to the moment: countdown and decisions before the trip, "now / next"
// while it's underway, and a wrap-up once it's over.
export default function HomeView({ trip, days, tasks, ideas, grandTotal, people, exchangeRate, onNavigate, documents }: HomeViewProps) {
  const now = useNow();
  const phase = trip ? tripPhase(trip.startDate, days.length, now) : null;
  const during = phase?.phase === "during" ? phase : null;
  const after = phase?.phase === "after";

  const pending = tasks.filter((t) => !t.done);
  const today = during ? days[during.dayIdx] : undefined;
  const tomorrow = during ? days[during.dayIdx + 1] : undefined;
  const todayTasks = today ? pending.filter((t) => t.dayId === today.id) : [];
  const toDecide = pending
    .filter((t) => !todayTasks.includes(t))
    .filter((t) => (t.options?.length ?? 0) > 0 || t.priority === "alta")
    .slice(0, 4);

  const openIdeas = ideas.filter((i) => (i.status ?? "idea") === "idea");
  const unsortedIdeas = openIdeas.filter((i) => !i.place || !i.cat).length;
  const toItinerary = () => onNavigate("calendar");
  const toTasks = () => onNavigate("tasks");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:gap-5">
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        {during && today ? (
          <TodayCard
            day={today}
            dayIdx={during.dayIdx}
            dayCount={days.length}
            hour={during.hour}
            tomorrow={tomorrow}
            onOpenItinerary={toItinerary}
          />
        ) : (
          <Hero phase={phase} days={days} people={people} />
        )}

        {!after && (
          <section className={PANEL}>
            <SectionTitle title={during ? "Mañana" : "Primeros días"} action="Itinerario" onAction={toItinerary} />
            {during ? (
              tomorrow
                ? <DayAgenda day={tomorrow} limit={4} onOpen={toItinerary} />
                : <p className="text-[13px] text-muted-foreground">Hoy es el último día del viaje.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {days.slice(0, 2).map((d) => <DayAgenda key={d.id} day={d} limit={4} onOpen={toItinerary} />)}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        {todayTasks.length > 0 && (
          <section className={PANEL}>
            <SectionTitle title="Pendientes de hoy" count={todayTasks.length} action="Ver" onAction={toTasks} />
            <TaskList tasks={todayTasks} people={people} exchangeRate={exchangeRate} onOpen={toTasks} />
          </section>
        )}

        {(!after || pending.length > 0) && (
          <section className={PANEL}>
            <SectionTitle title={after ? "Quedaron pendientes" : "Por decidir"} count={pending.length} action="Pendientes" onAction={toTasks} />
            {!during && !after && <Progress done={tasks.length - pending.length} total={tasks.length} />}
            {toDecide.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                {pending.length === 0 ? "Todo al día. ¡Nada pendiente!" : "Nada urgente por ahora."}
              </p>
            ) : (
              <TaskList tasks={toDecide} people={people} exchangeRate={exchangeRate} onOpen={toTasks} />
            )}
          </section>
        )}

        {!after && (
          <section className={PANEL}>
            <SectionTitle title="Ideas del grupo" count={openIdeas.length} action="Ideas" onAction={() => onNavigate("ideas")} />
            <p className="text-[13px] text-secondary-foreground">
              {openIdeas.length === 0
                ? "Guarden aquí los reels y TikToks de comida, planes y tips de los lugares del viaje."
                : unsortedIdeas > 0
                  ? `${unsortedIdeas} ${unsortedIdeas === 1 ? "idea espera" : "ideas esperan"} lugar o tipo. Organícenlas y voten sus favoritas.`
                  : "Todas las ideas están organizadas por lugar. Voten sus favoritas."}
            </p>
          </section>
        )}

        <section className={PANEL}>
          <SectionTitle title={after ? "Gasto final" : "Presupuesto"} action="Gastos" onAction={() => onNavigate("budget")} />
          <div className="text-2xl font-semibold tracking-tight">
            {fmtUSD(grandTotal / people)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">por persona</span>
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            {fmtUSD(grandTotal)} en total entre {people} {people === 1 ? "viajero" : "viajeros"}
          </div>
        </section>

        {documents}
      </div>
    </div>
  );
}

function Hero({ phase, days, people }: { phase: TripPhase | null; days: Day[]; people: number }) {
  const hero = heroCopy(phase, days.length);
  const activities = days.reduce((n, d) => n + d.events.length, 0);
  return (
    <section className={cn(PANEL, "bg-linear-to-br from-accent to-card")}>
      <div className="text-[28px] font-semibold leading-tight tracking-tight text-foreground md:text-[34px]">{hero.big}</div>
      <div className="mt-1 text-sm text-secondary-foreground">{hero.small}</div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-secondary-foreground">
        <span><strong className="font-semibold text-foreground">{days.length}</strong> días</span>
        <span><strong className="font-semibold text-foreground">{activities}</strong> actividades</span>
        <span><strong className="font-semibold text-foreground">{people}</strong> {people === 1 ? "viajero" : "viajeros"}</span>
      </div>
    </section>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <div className="mb-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{done} de {total} listos</div>
    </div>
  );
}

function TaskList({ tasks, people, exchangeRate, onOpen }: {
  tasks: Task[]; people: number; exchangeRate: number; onOpen: () => void;
}) {
  return (
    <ul className="-mx-2 flex flex-col">
      {tasks.map((t) => {
        const cat = TASK_CATEGORIES[t.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
        const options = t.options ?? [];
        const costs = options.map((o) => optionGroupUSD(o, people, exchangeRate));
        const detail = options.length > 0
          ? `${options.length} opciones · desde ${fmtUSDNum(Math.min(...costs))}`
          : t.start != null
            ? fmtHour(t.start)
            : t.priority === "alta" ? "Prioridad alta" : cat.label;
        return (
          <li key={t.id}>
            <button
              onClick={onOpen}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-secondary"
            >
              <span className="text-base">{cat.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{t.title}</span>
                <span className="block text-xs text-muted-foreground">{detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
