"use client";
import type { TripBooking, TripCompanion } from "@/types";
import { LIMITS } from "@/constants/limits";
import { BOOKINGS, BOOKING_KEYS, COMPANIONS, COMPANION_KEYS, MAX_TRIP_PEOPLE } from "@/constants/tripSetup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DateRangeFields from "@/components/DateRangeFields";
import ChoiceChip from "@/components/gate/wizard/ChoiceChip";
import PeopleStepper from "@/components/gate/wizard/PeopleStepper";
import { onEnterKey } from "@/components/gate/wizard/model";

export function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold">{title}</h2>
      <p className="text-[13px] leading-relaxed text-secondary-foreground">{hint}</p>
    </div>
  );
}

interface DestinationStepProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function DestinationStep({ value, onChange, onNext, onSkip }: DestinationStepProps) {
  return (
    <>
      <StepHeading title="¿A dónde van?" hint="Una ciudad, un país o una región. Lo puedes cambiar después." />
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onEnterKey(onNext)}
        placeholder="Ej. Cartagena"
        maxLength={LIMITS.name}
        enterKeyHint="next"
        className="h-10 bg-secondary text-[15px]"
      />
      <Button variant="outline" onClick={onSkip} className="h-9 self-start rounded-full bg-card px-3.5 text-[13px]">
        🤔 Aún no sé
      </Button>
    </>
  );
}

interface DatesStepProps {
  startDate: string;
  endDate: string;
  dayCount: number | null;
  onChange: (dates: { startDate?: string; endDate?: string }) => void;
}

export function DatesStep({ startDate, endDate, dayCount, onChange }: DatesStepProps) {
  return (
    <>
      <StepHeading title="¿Cuándo?" hint="Con las fechas armamos un día del itinerario por cada día del viaje." />
      <DateRangeFields startDate={startDate} endDate={endDate} dayCount={dayCount} onChange={onChange} />
    </>
  );
}

interface CompanionStepProps {
  companion: TripCompanion | null;
  people: number;
  onCompanion: (companion: TripCompanion) => void;
  onPeople: (people: number) => void;
}

export function CompanionStep({ companion, people, onCompanion, onPeople }: CompanionStepProps) {
  return (
    <>
      <StepHeading title="¿Con quién viajas?" hint="Así repartimos los gastos entre todos. Lo puedes ajustar después." />
      <div className="grid grid-cols-2 gap-2">
        {COMPANION_KEYS.map((key) => (
          <ChoiceChip
            key={key}
            selected={companion === key}
            onClick={() => onCompanion(key)}
            className="h-16 flex-col gap-1 rounded-xl"
          >
            <span className="text-xl leading-none">{COMPANIONS[key].icon}</span>
            {COMPANIONS[key].label}
          </ChoiceChip>
        ))}
      </div>
      <PeopleStepper value={people} min={1} max={MAX_TRIP_PEOPLE} onChange={onPeople} />
    </>
  );
}

interface BookingsStepProps {
  resolved: TripBooking[];
  nothingYet: boolean;
  onToggle: (booking: TripBooking) => void;
  onNothingYet: () => void;
}

export function BookingsStep({ resolved, nothingYet, onToggle, onNothingYet }: BookingsStepProps) {
  return (
    <>
      <StepHeading title="¿Qué ya tienen resuelto?" hint="Lo que falte lo anotamos en Pendientes para que no se les pase." />
      <div className="flex flex-wrap gap-2">
        {BOOKING_KEYS.map((key) => (
          <ChoiceChip key={key} selected={resolved.includes(key)} onClick={() => onToggle(key)}>
            {BOOKINGS[key].icon} {BOOKINGS[key].label}
          </ChoiceChip>
        ))}
        <ChoiceChip selected={nothingYet} onClick={onNothingYet}>
          🤷 Nada todavía
        </ChoiceChip>
      </div>
    </>
  );
}
