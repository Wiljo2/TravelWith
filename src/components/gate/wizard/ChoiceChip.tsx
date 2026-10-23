"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChoiceChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

export default function ChoiceChip({ selected, onClick, children, className }: ChoiceChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-10 rounded-full bg-card px-3.5 text-[13px]",
        selected && "border-ring bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {children}
    </Button>
  );
}
