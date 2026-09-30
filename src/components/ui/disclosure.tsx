"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  title: React.ReactNode;
  // Short hint shown next to the title while collapsed (a count, a total…).
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Collapsible section for secondary settings, built on native <details>.
export function Disclosure({ title, hint, defaultOpen, className, children }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn("group border-t border-border", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-[13px] font-medium text-foreground select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="flex-1">{title}</span>
        {hint != null && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </summary>
      <div className="pb-3 pl-6">{children}</div>
    </details>
  );
}
