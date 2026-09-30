"use client";
import { HOUR_START, HOUR_END, PX_PER_HOUR } from "@/constants/time";
import { fmtHourShort } from "@/utils/time";

export default function HourGutter({ width = 56 }: { width?: number }) {
  const hours: number[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  return (
    <div className="relative shrink-0" style={{ width }}>
      {hours.map((h) => (
        <div key={h} className="relative border-t border-border" style={{ height: PX_PER_HOUR }}>
          <span className="absolute -top-2 right-1.5 bg-background px-0.5 text-[11px] tabular-nums text-muted-foreground md:right-2">
            {fmtHourShort(h)}
          </span>
        </div>
      ))}
    </div>
  );
}
