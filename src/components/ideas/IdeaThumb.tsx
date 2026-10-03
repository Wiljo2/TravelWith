"use client";
import { useState } from "react";
import { IDEA_PLATFORMS } from "@/constants/ideaPlatforms";
import { ideaThumbSrc, thumbRoute } from "@/utils/ideaMedia";
import { cn } from "@/lib/utils";
import type { Idea } from "@/types";

// An idea's cover: the stored one while it's valid, then the app's cover route
// (always fresh), and the network's badge if neither loads.
export default function IdeaThumb({ idea, roomCode, className }: { idea: Idea; roomCode: string; className?: string }) {
  const primary = ideaThumbSrc(roomCode, idea);
  const route = idea.platform === "tiktok" || idea.platform === "youtube" ? thumbRoute(roomCode, idea) : undefined;
  const [failed, setFailed] = useState<string[]>([]);
  const src = [primary, route].find((s) => s && !failed.includes(s));
  const p = IDEA_PLATFORMS[idea.platform];

  if (!src) {
    return <span className={cn("flex items-center justify-center text-sm font-bold", p.className, className)}>{p.short}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote covers, not optimizable
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn("bg-secondary object-cover", className)}
      onError={() => setFailed((f) => [...f, src])}
    />
  );
}
