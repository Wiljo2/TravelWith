"use client";
import { ExternalLink } from "lucide-react";
import { driveFileUrl } from "@/utils/driveLinks";
import { cn } from "@/lib/utils";
import type { TripDocument } from "@/types";

// Opens the file in Drive; Drive decides whether this person may see it.
export default function DocumentLink({ doc, label = "Ver documento", className }: {
  doc: TripDocument;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={driveFileUrl(doc.driveFileId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline", className)}
    >
      <ExternalLink className="size-3.5" /> {label}
    </a>
  );
}
