"use client";
import { cn } from "@/lib/utils";

interface PriceChipProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  strong?: boolean;
}

export default function PriceChip({ label, value, sub, accent, strong }: PriceChipProps) {
  return (
    <div
      className={cn(
        "min-w-[110px] rounded-[10px] border px-3.5 py-2",
        strong
          ? "border-[#26215C] bg-[#26215C]"
          : accent
            ? "border-[#0F6E56] bg-accent"
            : "border-border bg-card",
      )}
    >
      <div className={cn(
        "text-[10.5px] font-medium",
        strong ? "text-[#CECBF6]" : accent ? "text-[#0F6E56]" : "text-secondary-foreground",
      )}>
        {label}
      </div>
      <div className={cn(
        "text-lg font-semibold tabular-nums",
        strong ? "text-white" : accent ? "text-accent-foreground" : "text-foreground",
      )}>
        {value}
      </div>
      {sub && (
        <div className={cn("text-[10px]", strong ? "text-[#AFA9EC]" : "text-muted-foreground")}>
          {sub}
        </div>
      )}
    </div>
  );
}
