"use client";
import { MAX_TRIP_DAYS, fmtTripDates } from "@/utils/tripDays";
import { Input } from "@/components/ui/input";

interface DateRangeFieldsProps {
  startDate: string;
  endDate: string;
  // Days in the range (generateDays), or null while it is incomplete or invalid.
  dayCount: number | null;
  onChange: (dates: { startDate?: string; endDate?: string }) => void;
}

// "Ida" / "Regreso" date inputs, with what is wrong with the range or how long it is.
export default function DateRangeFields({ startDate, endDate, dayCount, onChange }: DateRangeFieldsProps) {
  const problem = startDate && endDate && !dayCount
    ? endDate < startDate ? "El regreso tiene que ser el mismo día de la ida o después." : `Un viaje puede durar hasta ${MAX_TRIP_DAYS} días.`
    : "";

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-secondary-foreground">
          Ida
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="mt-1 h-10 bg-secondary text-[13px]"
          />
        </label>
        <label className="text-[11px] text-secondary-foreground">
          Regreso
          <Input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className="mt-1 h-10 bg-secondary text-[13px]"
          />
        </label>
      </div>
      {problem ? (
        <p className="text-xs text-destructive">{problem}</p>
      ) : dayCount ? (
        <p className="text-xs text-muted-foreground">
          {fmtTripDates(startDate, endDate)} · {dayCount} {dayCount === 1 ? "día" : "días"}
        </p>
      ) : null}
    </>
  );
}
