"use client";
import { useState } from "react";
import { Check, Lightbulb, Plus } from "lucide-react";
import IdeaRow from "@/components/ideas/IdeaRow";
import IdeaGroup from "@/components/ideas/IdeaGroup";
import AddIdeaForm from "@/components/ideas/AddIdeaForm";
import OrganizeWithAI from "@/components/ideas/OrganizeWithAI";
import PlacesEditor from "@/components/ideas/PlacesEditor";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Disclosure } from "@/components/ui/disclosure";
import { PANEL } from "@/components/home/shared";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { cn } from "@/lib/utils";
import type { Idea, IdeaSuggestion } from "@/types";
import type { PlaceProfiles } from "@/utils/ideas";

interface IdeasViewProps {
  ideas: Idea[];
  profiles: PlaceProfiles;
  loadingIds: Set<string>;
  mobile: boolean;
  voter: string;
  onAdd: (text: string, note: string) => number;
  onUpdate: (id: string, patch: Partial<Idea>) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onApplySuggestions: (suggestions: Map<string, IdeaSuggestion>) => number;
  onAcceptAll: () => void;
  onSetNote: (id: string, note: string) => void;
  onRetry: (id: string) => Promise<Idea | null>;
  onAddPlace: (place: string) => void;
  onRemovePlace: (place: string) => void;
}

const ALL = "all";
const REVIEW = "review";

// Inspiration board: reels/TikToks about the trip's places, grouped by place and
// filtered by type. Kept apart from the itinerary on purpose.
export default function IdeasView({
  ideas, profiles, loadingIds, mobile, voter,
  onAdd, onUpdate, onRemove, onVote, onApplySuggestions, onAcceptAll, onSetNote, onRetry, onAddPlace, onRemovePlace,
}: IdeasViewProps) {
  const places = Object.keys(profiles);
  const [filter, setFilter] = useState<string>(ALL);
  const [adding, setAdding] = useState(false);
  // Remounts the add form each time it opens, so it starts empty.
  const [formKey, setFormKey] = useState(0);
  const openForm = () => { setFormKey((k) => k + 1); setAdding(true); };

  const active = ideas.filter((i) => i.status !== "discarded");
  const discarded = ideas.filter((i) => i.status === "discarded");
  const validCat = (i: Idea) => (i.cat && IDEA_TYPES[i.cat] ? i.cat : undefined);
  // Needs a human look: unclassified, or a suggestion waiting for "Sí".
  const needsReview = (i: Idea) => !i.place || !validCat(i) || !!(i.suggestion?.place || i.suggestion?.cat);
  const toReview = active.filter(needsReview);
  const toClassify = active.filter((i) => !i.place || !validCat(i));
  const withSuggestion = active.filter((i) => i.suggestion?.place || i.suggestion?.cat).length;
  // Group by the confirmed place, or the suggested one while it awaits a "Sí".
  const placeOf = (i: Idea) => {
    const p = i.place ?? i.suggestion?.place;
    return p && places.includes(p) ? p : undefined;
  };
  const visible = filter === ALL ? active : filter === REVIEW ? toReview : active.filter((i) => validCat(i) === filter);

  // Newest first while loading, then most-liked.
  const order = (a: Idea, b: Idea) =>
    (b.votes?.length ?? 0) - (a.votes?.length ?? 0) || b.createdAt.localeCompare(a.createdAt);
  const groups = [
    { key: "__none", title: "Sin lugar", items: visible.filter((i) => !placeOf(i)) },
    ...places.map((p) => ({ key: p, title: p, items: visible.filter((i) => placeOf(i) === p) })),
  ].filter((g) => g.items.length > 0);

  const row = (idea: Idea, showPlace: boolean) => (
    <IdeaRow
      key={idea.id}
      idea={idea}
      places={places}
      voter={voter}
      loading={loadingIds.has(idea.id)}
      showPlace={showPlace}
      onUpdate={(patch) => onUpdate(idea.id, patch)}
      onVote={() => onVote(idea.id)}
      onRemove={() => onRemove(idea.id)}
      onSetNote={(note) => onSetNote(idea.id, note)}
      onRetry={() => onRetry(idea.id)}
    />
  );
  const form = <AddIdeaForm key={formKey} onSubmit={onAdd} onDone={() => setAdding(false)} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openForm} className="h-9 gap-1.5 rounded-full px-4 font-semibold">
          <Plus className="size-4" /> Agregar idea
        </Button>
        <OrganizeWithAI ideas={toClassify} profiles={profiles} onApply={onApplySuggestions} onEnrich={(i) => onRetry(i.id)} />
        {withSuggestion > 1 && (
          <Button variant="ghost" onClick={onAcceptAll} className="ml-auto h-9 gap-1.5 rounded-full px-3 text-emerald-800">
            <Check className="size-4" /> Aceptar todas ({withSuggestion})
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          <FilterChip label="Todas" count={active.length} active={filter === ALL} onClick={() => setFilter(ALL)} />
          {toReview.length > 0 && (
            <FilterChip label="Por revisar" count={toReview.length} active={filter === REVIEW} onClick={() => setFilter(REVIEW)} tone="amber" />
          )}
          {Object.entries(IDEA_TYPES).map(([k, t]) => {
            const n = active.filter((i) => validCat(i) === k).length;
            return n > 0 && (
              <FilterChip key={k} label={`${t.icon} ${t.label}`} count={n} active={filter === k} onClick={() => setFilter(k)} />
            );
          })}
        </div>
      )}

      {ideas.length === 0 ? (
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
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          {filter === REVIEW ? "Todo está revisado. 🎉" : "No hay ideas de este tipo todavía."}
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <IdeaGroup key={g.key} title={g.title} count={g.items.length} muted={g.key === "__none"}>
              {[...g.items].sort(order).map((i) => row(i, false))}
            </IdeaGroup>
          ))}
        </div>
      )}

      <div>
        <Disclosure title="Lugares del viaje" hint={places.length} className={discarded.length ? "" : "border-b"}>
          <PlacesEditor places={places} onAdd={onAddPlace} onRemove={onRemovePlace} />
        </Disclosure>
        {discarded.length > 0 && (
          <Disclosure title="Descartadas" hint={discarded.length} className="border-b">
            <ul className="divide-y divide-border">{discarded.map((i) => row(i, true))}</ul>
          </Disclosure>
        )}
      </div>

      {mobile ? (
        <BottomSheet open={adding} onOpenChange={setAdding} title="Nueva idea">{form}</BottomSheet>
      ) : (
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader><DialogTitle>Nueva idea</DialogTitle></DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
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
