"use client";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { NewTrip, TripBooking, TripCompanion } from "@/types";
import { COMPANIONS } from "@/constants/tripSetup";
import { generateDays } from "@/utils/tripDays";
import { clampPeople, placeholderTravelers, starterTasks, suggestTripName } from "@/utils/tripSetup";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { INITIAL_ANSWERS, type WizardAnswers } from "@/components/gate/wizard/model";
import { BookingsStep, CompanionStep, DatesStep, DestinationStep } from "@/components/gate/wizard/QuestionSteps";
import ConfirmStep from "@/components/gate/wizard/ConfirmStep";

const QUESTIONS = 4;
// "Crear viaje" appears where "Siguiente" was: ignore a double click that lands on it.
const CONFIRM_CLICK_GUARD_MS = 600;

interface CreateTripWizardProps {
  loading: boolean;
  error: string;
  onSubmit: (trip: NewTrip) => void;
  onCancel: () => void;
}

export default function CreateTripWizard({ loading, error, onSubmit, onCancel }: CreateTripWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>(INITIAL_ANSWERS);
  const [customName, setCustomName] = useState<string | null>(null);
  const confirmShownAt = useRef(0);

  const update = (patch: Partial<WizardAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const dayCount = generateDays(answers.startDate, answers.endDate)?.length ?? null;
  const suggestedName = suggestTripName(answers.destination, answers.companion, answers.startDate);
  const name = customName ?? suggestedName;
  const confirming = step === QUESTIONS;
  const canAdvance = step === 0 ? answers.destination.trim().length > 0 : step === 1 ? !!dayCount : true;
  const canCreate = !!dayCount && name.trim().length > 0;

  function next() {
    if (!canAdvance) return;
    if (step === QUESTIONS - 1) confirmShownAt.current = Date.now();
    setStep((s) => Math.min(s + 1, QUESTIONS));
  }

  function skipDestination() {
    update({ destination: "" });
    setStep(1);
  }

  function chooseCompanion(companion: TripCompanion) {
    update({ companion, people: COMPANIONS[companion].people });
  }

  function toggleBooking(booking: TripBooking) {
    const resolved = answers.resolved.includes(booking)
      ? answers.resolved.filter((b) => b !== booking)
      : [...answers.resolved, booking];
    update({ resolved, nothingYet: false });
  }

  function submit() {
    if (!canCreate || loading || Date.now() - confirmShownAt.current < CONFIRM_CLICK_GUARD_MS) return;
    onSubmit({
      name: name.trim(),
      destination: answers.destination.trim() || undefined,
      startDate: answers.startDate,
      endDate: answers.endDate,
      travelers: placeholderTravelers(answers.people),
      tasks: starterTasks(answers.resolved),
    });
  }

  const body = [
    <DestinationStep
      key="destination"
      value={answers.destination}
      onChange={(destination) => update({ destination })}
      onNext={next}
      onSkip={skipDestination}
    />,
    <DatesStep key="dates" startDate={answers.startDate} endDate={answers.endDate} dayCount={dayCount} onChange={update} />,
    <CompanionStep
      key="companion"
      companion={answers.companion}
      people={answers.people}
      onCompanion={chooseCompanion}
      onPeople={(people) => update({ people: clampPeople(people) })}
    />,
    <BookingsStep
      key="bookings"
      resolved={answers.resolved}
      nothingYet={answers.nothingYet}
      onToggle={toggleBooking}
      onNothingYet={() => update({ resolved: [], nothingYet: !answers.nothingYet })}
    />,
    <ConfirmStep
      key="confirm"
      answers={answers}
      dayCount={dayCount ?? 0}
      name={name}
      suggestedName={suggestedName}
      onName={setCustomName}
      onSubmit={submit}
    />,
  ][step];

  return (
    <Card className="rounded-xl py-4">
      <CardContent className="flex flex-col gap-4 px-4">
        <div className="flex items-start gap-2">
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-[.06em] text-muted-foreground">
              <span>NUEVO VIAJE</span>
              <span>{confirming ? "Último paso" : `${step + 1} de ${QUESTIONS}`}</span>
            </div>
            <div aria-hidden className="flex gap-1">
              {Array.from({ length: QUESTIONS }, (_, i) => (
                <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cancelar" onClick={onCancel} disabled={loading} className="-mr-1 text-muted-foreground">
            <X />
          </Button>
        </div>

        <div className="flex min-h-[210px] flex-col gap-3">{body}</div>

        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={loading} className="h-10 px-4">
              Atrás
            </Button>
          )}
          {confirming ? (
            <Button key="create" onClick={submit} disabled={loading || !canCreate} className="h-10 flex-1 font-semibold">
              {loading ? "Creando..." : "Crear viaje"}
            </Button>
          ) : (
            <Button key="next" onClick={next} disabled={!canAdvance} className="h-10 flex-1 font-semibold">
              Siguiente
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
