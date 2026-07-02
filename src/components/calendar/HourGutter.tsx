"use client";
import { HOUR_START, HOUR_END, PX_PER_HOUR } from "@/constants/time";
import { fmtHourShort } from "@/utils/time";

export default function HourGutter() {
  const hours: number[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  return (
    <div className="relative w-14 shrink-0">
      {hours.map((h) => (
        <div key={h} className="relative border-t border-border" style={{ height: PX_PER_HOUR }}>
          <span className="absolute -top-2 right-2 bg-background px-0.5 text-[11px] tabular-nums text-muted-foreground">
            {fmtHourShort(h)}
          </span>
        </div>
      ))}
    </div>
  );
}
