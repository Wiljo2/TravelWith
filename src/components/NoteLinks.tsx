"use client";
import { extractUrls, linkLabel } from "@/utils/linkify";

// Renders clickable chips for any URLs found in a note. Sits under the note
// editors so saved links (prices pages, reservations…) are one click away.
export default function NoteLinks({ note }: { note: string | undefined }) {
  const urls = extractUrls(note);
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="flex max-w-[180px] items-center gap-1 truncate rounded-full border border-border bg-secondary px-2 py-0.5 text-[10.5px] text-[#2563EB] hover:underline"
          title={url}
        >
          ↗ {linkLabel(url)}
        </a>
      ))}
    </div>
  );
}
