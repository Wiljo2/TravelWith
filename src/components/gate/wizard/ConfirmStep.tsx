"use client";
import { LIMITS } from "@/constants/limits";
import { COMPANIONS } from "@/constants/tripSetup";
import { fmtTripDates } from "@/utils/tripDays";
import { starterTasks } from "@/utils/tripSetup";
import { Input } from "@/components/ui/input";
import { StepHeading } from "@/components/gate/wizard/QuestionSteps";
import { onEnterKey, type WizardAnswers } from "@/components/gate/wizard/model";

interface ConfirmStepProps {
  answers: WizardAnswers;
  dayCount: number;
  name: string;
  suggestedName: string;
  onName: (name: string) => void;
  onSubmit: () => void;
}

function whoText({ companion, people }: WizardAnswers): string {
  if (people === 1) return "Solo tú";
  const count = `${people} personas`;
  return companion && companion !== "solo" ? `${COMPANIONS[companion].label} · ${count}` : count;
}

export default function ConfirmStep({ answers, dayCount, name, suggestedName, onName, onSubmit }: ConfirmStepProps) {
  const tasks = starterTasks(answers.resolved);
  const rows = [
    { icon: "📍", text: answers.destination.trim() || "Destino por definir" },
    { icon: "📅", text: `${fmtTripDates(answers.startDate, answers.endDate)} · ${dayCount} ${dayCount === 1 ? "día" : "días"}` },
    { icon: "👥", text: whoText(answers) },
    { icon: "📝", text: tasks.length ? `En Pendientes: ${tasks.map((t) => t.title).join(", ")}` : "Vuelos y alojamiento listos" },
  ];

  return (
    <>
      <StepHeading title="Tu viaje" hint="Revisa y crea. Todo se puede cambiar después." />
      <label className="text-[11px] text-secondary-foreground">
        Nombre del viaje
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={onEnterKey(onSubmit)}
          placeholder={suggestedName}
          maxLength={LIMITS.name}
          enterKeyHint="done"
          className="mt-1 h-10 bg-secondary text-[15px]"
        />
      </label>
      <ul className="flex flex-col gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-[13px]">
        {rows.map((row) => (
          <li key={row.icon} className="flex gap-2">
            <span aria-hidden>{row.icon}</span>
            <span className="min-w-0 flex-1 break-words">{row.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
