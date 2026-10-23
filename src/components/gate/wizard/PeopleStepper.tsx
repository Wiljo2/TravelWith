"use client";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PeopleStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export default function PeopleStepper({ value, min, max, onChange }: PeopleStepperProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2">
      <span className="text-[13px] leading-snug text-secondary-foreground">¿Cuántos son, contándote a ti?</span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Una persona menos"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="bg-card"
        >
          <Minus />
        </Button>
        <span aria-live="polite" className="w-8 text-center text-base font-semibold tabular-nums">{value}</span>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Una persona más"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="bg-card"
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
