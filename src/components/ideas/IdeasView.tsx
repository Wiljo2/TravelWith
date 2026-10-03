"use client";
import { useState } from "react";
import { Check, Lightbulb, Plus } from "lucide-react";
import IdeaCard from "@/components/ideas/IdeaCard";
import IdeaViewer from "@/components/ideas/IdeaViewer";
import IdeasByDay from "@/components/ideas/IdeasByDay";
import AddIdeaForm from "@/components/ideas/AddIdeaForm";
import AnalyzeWithClaude from "@/components/ideas/AnalyzeWithClaude";
import PlacesEditor from "@/components/ideas/PlacesEditor";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Disclosure } from "@/components/ui/disclosure";
import { PANEL } from "@/components/home/shared";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { fmtHour } from "@/utils/time";
import { cn } from "@/lib/utils";
import type { Day, Idea, IdeaLink, IdeaPlanResult } from "@/types";
import type { PlaceIndex } from "@/utils/ideas";
import { isVenue } from "@/utils/places";

interface IdeasViewProps {
  ideas: Idea[];
  index: PlaceIndex;
  roomCode: string;
  loadingIds: Set<string>;
  mobile: boolean;
  voter: string;
  onAdd: (text: string, note: string) => number;
  onUpdate: (id: string, patch: Partial<Idea>) => void;
  onSetPlace: (id: string, place: string | undefined) => void;
  onSetCat: (id: string, cat: string | undefined) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onApplyClaude: (classes: IdeaPlanResult["classes"]) => void;
  onAcceptAll: () => void;
  onSetNote: (id: string, note: string) => void;
  onRetry: (id: string) => Promise<Idea | null>;
  onAddPlace: (place: string) => void;
  onRemovePlace: (place: string) => void;
  days: Day[];
  planLinks?: IdeaLink[];
  planLinksAt?: string;
  planIdeaIds?: string[];
  onAnalyze: (ideaIds?: string[]) => Promise<IdeaPlanResult>;
  onSavePlan: (links: IdeaLink[], at: string, ideaIds: string[]) => void;
}

const ALL = "all";
const REVIEW = "review";
// Phone: a swipeable row of cards per place; desktop: a grid.
const ROW = "-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden";
const CARD = "w-[38%] max-w-[170px] md:w-auto md:max-w-none";

// Inspiration board: reels/TikToks about the trip's places, as cover cards
// grouped by place (or over the itinerary, by day). Tapping one plays it.
export default function IdeasView({
  ideas, index, roomCode, loadingIds, mobile, voter,
  onAdd, onUpdate, onSetPlace, onSetCat, onRemove, onVote, onApplyClaude, onAcceptAll, onSetNote, onRetry, onAddPlace, onRemovePlace,
  days, planLinks, planLinksAt, planIdeaIds, onAnalyze, onSavePlan,
}: IdeasViewProps) {
  const places = index.places.map((p) => p.name);
  const areas = index.places.filter((p) => !isVenue(p)).map((p) => p.name);
  const venues = index.places.filter(isVenue).map((p) => p.name);
  const [filter, setFilter] = useState<string>(ALL);
  const [view, setView] = useState<"place" | "day">("place");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  // Keeps the last idea on screen while the sheet animates closed.
  const [shown, setShown] = useState<string | null>(null);
  if (viewing && viewing !== shown) setShown(viewing);
  // Remounts the add form each time it opens, so it starts empty.
  const [formKey, setFormKey] = useState(0);
  const openForm = () => { setFormKey((k) => k + 1); setAdding(true); };

  const active = ideas.filter((i) => i.status !== "discarded");
  const discarded = ideas.filter((i) => i.status === "discarded");
  const validCat = (i: Idea) => (i.cat && IDEA_TYPES[i.cat] ? i.cat : undefined);
  const toReview = active.filter((i) => !i.place || !validCat(i));
  const withSuggestion = active.filter((i) => i.suggestion?.place || i.suggestion?.cat).length;
  const placeOf = (i: Idea) => (i.place && places.includes(i.place) ? i.place : undefined);
  const visible = filter === ALL ? active : filter === REVIEW ? toReview : active.filter((i) => validCat(i) === filter);

  // Most-liked first, then newest.
  const order = (a: Idea, b: Idea) =>
    (b.votes?.length ?? 0) - (a.votes?.length ?? 0) || b.createdAt.localeCompare(a.createdAt);
  const groups = [
    { key: "__none", title: "Sin lugar", items: visible.filter((i) => !placeOf(i)) },
    ...index.places.map((p) => ({ key: p.name, title: p.name, sub: [...p.parents].sort((x, y) => x.length - y.length)[0], items: visible.filter((i) => placeOf(i) === p.name) })),
  ].filter((g) => g.items.length > 0);

  const card = (idea: Idea) => (
    <IdeaCard key={idea.id} idea={idea} roomCode={roomCode} loading={loadingIds.has(idea.id)} onOpen={() => setViewing(idea.id)} className={CARD} />
  );

  // Where the opened idea fits the plan, from the last analysis.
  const current = ideas.find((i) => i.id === shown);
  const link = current && planLinks?.find((l) => l.ideaId === current.id);
  const linkDay = link && days.find((d) => d.id === link.dayId);
  const linkEvent = link?.eventId ? linkDay?.events.find((e) => e.id === link.eventId) : undefined;
  const plan = link && linkDay ? {
    when: [link.before ? "Antes del viaje · para" : undefined, linkDay.label, linkEvent ? `${fmtHour(linkEvent.start)} ${linkEvent.title}` : link.slot ? `Libre ${fmtHour(link.slot.start)}` : undefined].filter(Boolean).join(" · "),
    reason: link.reason,
  } : undefined;
  const viewer = current && (
    <IdeaViewer
      key={current.id}
      idea={current}
      roomCode={roomCode}
      places={places}
      voter={voter}
      loading={loadingIds.has(current.id)}
      plan={plan}
      onUpdate={(patch) => onUpdate(current.id, patch)}
      onSetPlace={(place) => onSetPlace(current.id, place)}
      onSetCat={(cat) => onSetCat(current.id, cat)}
      onVote={() => onVote(current.id)}
      onRemove={() => { onRemove(current.id); setViewing(null); }}
      onSetNote={(note) => onSetNote(current.id, note)}
      onRetry={() => onRetry(current.id)}
    />
  );
  const form = <AddIdeaForm key={formKey} onSubmit={onAdd} onDone={() => setAdding(false)} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openForm} className="h-9 gap-1.5 rounded-full px-4 font-semibold">
          <Plus className="size-4" /> Agregar idea
        </Button>
        <AnalyzeWithClaude
          ideas={active}
          reading={active.filter((i) => loadingIds.has(i.id)).length}
          planLinks={planLinks}
          planLinksAt={planLinksAt}
          planIdeaIds={planIdeaIds}
          onAnalyze={onAnalyze}
          onSavePlan={onSavePlan}
          onApplyClaude={onApplyClaude}
        />
        {withSuggestion > 1 && (
          <Button variant="ghost" onClick={onAcceptAll} className="ml-auto h-9 gap-1.5 rounded-full px-3 text-emerald-800">
            <Check className="size-4" /> Aceptar sugerencias ({withSuggestion})
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <div className="inline-flex gap-1 self-start rounded-full bg-muted p-1">
          {([["place", "📍 Por lugar"], ["day", "📅 Por día"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                view === id ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === "day" && active.length > 0 ? (
        <IdeasByDay
          loadingIds={loadingIds}
          ideas={ideas}
          days={days}
          places={index.places}
          roomCode={roomCode}
          planLinks={planLinks}
          planLinksAt={planLinksAt}
          planIdeaIds={planIdeaIds}
          onOpen={setViewing}
        />
      ) : ideas.length === 0 ? (
        <section className={cn(PANEL, "flex flex-col items-center gap-3 py-10 text-center")}>
          <Lightbulb className="size-8 text-amber-500" />
          <div>
            <h2 className="text-[15px] font-semibold">Aún no hay ideas</h2>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
              Guarden aquí los reels y TikToks de comida, planes y tips de los lugares del viaje. Se organizan por lugar y
              todos pueden votar. No cambian el itinerario.
            </p>
          </div>
          <Button onClick={openForm} className="rounded-full px-5 font-semibold">Agregar la primera idea</Button>
        </section>
      ) : (
        <>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            <FilterChip label="Todas" count={active.length} active={filter === ALL} onClick={() => setFilter(ALL)} />
            {toReview.length > 0 && (
              <FilterChip label="Sin clasificar" count={toReview.length} active={filter === REVIEW} onClick={() => setFilter(REVIEW)} tone="amber" />
            )}
            {Object.entries(IDEA_TYPES).map(([k, t]) => {
              const n = active.filter((i) => validCat(i) === k).length;
              return n > 0 && <FilterChip key={k} label={`${t.icon} ${t.label}`} count={n} active={filter === k} onClick={() => setFilter(k)} />;
            })}
          </div>

          {groups.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              {filter === REVIEW ? "Todo está clasificado. 🎉" : "No hay ideas de este tipo todavía."}
            </p>
          ) : groups.map((g) => (
            <section key={g.key} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2">
                <span className={cn("truncate text-[15px] font-semibold", g.key === "__none" && "text-secondary-foreground")}>📍 {g.title}</span>
                {"sub" in g && g.sub && <span className="truncate text-xs text-muted-foreground">{g.sub}</span>}
                <span className="text-xs text-muted-foreground">{g.items.length}</span>
              </h2>
              <div className={ROW}>{[...g.items].sort(order).map(card)}</div>
            </section>
          ))}
        </>
      )}

      <div>
        <Disclosure title="Lugares del viaje" hint={places.length} className={discarded.length ? "" : "border-b"}>
          <PlacesEditor places={areas} venues={venues} onAdd={onAddPlace} onRemove={onRemovePlace} />
        </Disclosure>
        {discarded.length > 0 && (
          <Disclosure title="Descartadas" hint={discarded.length} className="border-b">
            <div className={cn(ROW, "pt-1")}>{discarded.map(card)}</div>
          </Disclosure>
        )}
      </div>

      {mobile ? (
        <>
          <BottomSheet open={adding} onOpenChange={setAdding} title="Nueva idea">{form}</BottomSheet>
          <BottomSheet open={viewing !== null} onOpenChange={(o) => { if (!o) setViewing(null); }} title="Idea">{viewer}</BottomSheet>
        </>
      ) : (
        <>
          <Dialog open={adding} onOpenChange={setAdding}>
            <DialogContent className="max-w-[440px]">
              <DialogHeader><DialogTitle>Nueva idea</DialogTitle></DialogHeader>
              {form}
            </DialogContent>
          </Dialog>
          <Dialog open={viewing !== null} onOpenChange={(o) => { if (!o) setViewing(null); }}>
            <DialogContent className="max-h-[92dvh] max-w-[460px] overflow-y-auto">
              <DialogHeader><DialogTitle>Idea</DialogTitle></DialogHeader>
              {viewer}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function FilterChip({ label, count, active, onClick, tone }: {
  label: string; count: number; active: boolean; onClick: () => void; tone?: "amber";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors",
        active
          ? "bg-foreground text-background ring-foreground"
          : tone === "amber"
            ? "bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100"
            : "bg-card text-secondary-foreground ring-border hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("text-xs", active ? "opacity-70" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}
