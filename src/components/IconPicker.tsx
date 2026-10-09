"use client";
import { useState, type ReactNode } from "react";
import { ICON_CHOICES } from "@/constants/itemIcons";
import { suggestIcon } from "@/utils/itemIcon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface IconPickerProps {
  value?: string;
  title: string;
  fallback: string;
  onChange: (icon: string | undefined) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export default function IconPicker({ value, title, fallback, onChange, disabled, children }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const suggested = suggestIcon(title);
  const auto = suggested || fallback;
  const choices = suggested ? [suggested, ...ICON_CHOICES.filter((e) => e !== suggested)] : [...ICON_CHOICES];

  const pick = (icon: string | undefined) => {
    setOpen(false);
    onChange(icon);
  };

  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 text-lg"
          aria-label="Cambiar ícono"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          {value || auto}
        </Button>
        {children}
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2">
          <button
            type="button"
            aria-pressed={value === undefined}
            onClick={() => pick(undefined)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-left text-xs text-secondary-foreground",
              value === undefined && "ring-2 ring-ring",
            )}
          >
            <span className="text-lg">{auto}</span>
            Automático
          </button>
          <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
            {choices.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                aria-pressed={value === emoji}
                onClick={() => pick(emoji)}
                className={cn(
                  "flex aspect-square w-full max-w-9 cursor-pointer items-center justify-center rounded-md text-lg hover:bg-secondary",
                  value === emoji && "ring-2 ring-ring",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
