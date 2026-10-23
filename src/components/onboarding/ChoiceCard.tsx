"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  icon: string;
  title: string;
  line: string;
  highlighted?: boolean;
  expanded?: boolean;
  onClick: () => void;
}

export default function ChoiceCard({ icon, title, line, highlighted, expanded, onClick }: ChoiceCardProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        "h-auto w-full justify-start gap-3 whitespace-normal rounded-xl bg-card px-3.5 py-3 text-left",
        highlighted && "border-ring bg-accent text-accent-foreground hover:bg-accent/70 hover:text-accent-foreground",
      )}
    >
      <span aria-hidden className="text-2xl leading-none">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className={cn("text-xs font-normal leading-snug", highlighted ? "text-accent-foreground/80" : "text-muted-foreground")}>
          {line}
        </span>
      </span>
    </Button>
  );
}
