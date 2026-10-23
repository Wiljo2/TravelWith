"use client";
import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import InviteSheet from "@/components/invite/InviteSheet";
import { PANEL, Progress } from "@/components/home/shared";
import { FIRST_STEPS } from "@/constants/firstSteps";
import { useFirstSteps } from "@/hooks/useFirstSteps";
import { cn } from "@/lib/utils";
import type { Tab } from "@/components/TabBar";
import type { TripInfo } from "@/types";
import type { FirstStep, FirstStepsData } from "@/utils/firstSteps";

interface FirstStepsCardProps {
  roomCode: string;
  trip: TripInfo | null;
  loaded: boolean;
  data: FirstStepsData;
  onNavigate: (tab: Tab) => void;
  // Documents live on Inicio: brings their panel into view.
  onOpenDocuments: () => void;
}

// What a new trip still lacks, with a shortcut to each; renders nothing once dismissed
// on this device or when the trip was already under way the first time it was seen here.
export default function FirstStepsCard({ roomCode, trip, loaded, data, onNavigate, onOpenDocuments }: FirstStepsCardProps) {
  const { steps, doneCount, visible, dismiss } = useFirstSteps({ roomCode, loaded, hasTrip: trip !== null, data });
  const [inviting, setInviting] = useState(false);
  if (!visible) return null;

  function open(step: FirstStep) {
    if (step.tab) onNavigate(step.tab);
    else if (step.key === "invite") setInviting(true);
    else onOpenDocuments();
  }

  return (
    <section className={PANEL}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Primeros pasos</h2>
        <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Ocultar primeros pasos" title="Ocultar" className="-my-1 -mr-1.5 text-muted-foreground">
          <X />
        </Button>
      </div>
      <Progress done={doneCount} total={steps.length} />
      {doneCount === steps.length ? (
        <p className="text-sm text-secondary-foreground">¡Listo! Tu viaje ya está en marcha.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {steps.map((step) => <StepRow key={step.key} step={step} onOpen={() => open(step)} />)}
        </ul>
      )}
      <InviteSheet open={inviting} onOpenChange={setInviting} roomCode={roomCode} tripName={trip?.name} />
    </section>
  );
}

function StepRow({ step, onOpen }: { step: FirstStep; onOpen: () => void }) {
  const mark = (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full",
        step.done ? "bg-primary text-primary-foreground" : "border-[1.5px] border-input",
      )}
    >
      {step.done && <Check className="size-3" strokeWidth={3} />}
    </span>
  );

  if (step.done) {
    return (
      <li className="flex items-center gap-3 px-2 py-2 text-sm text-muted-foreground">
        {mark}
        <span className="min-w-0 flex-1"><span className="sr-only">Hecho: </span>{step.label}</span>
      </li>
    );
  }
  return (
    <li>
      <Button
        variant="ghost"
        onClick={onOpen}
        className="h-auto w-full justify-start gap-3 whitespace-normal px-2 py-2 text-left font-normal"
      >
        {mark}
        <span className="min-w-0 flex-1 text-sm">{step.label}</span>
        <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-emerald-700">
          {FIRST_STEPS[step.key].action}
          <ChevronRight className="size-4" />
        </span>
      </Button>
    </li>
  );
}
