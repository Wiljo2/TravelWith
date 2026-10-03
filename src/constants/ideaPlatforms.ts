import type { IdeaPlatform } from "@/types";

// How each social network is labeled and badged on the ideas board.
export const IDEA_PLATFORMS: Record<IdeaPlatform, { label: string; short: string; className: string }> = {
  tiktok:    { label: "TikTok",    short: "TT", className: "bg-neutral-900 text-white" },
  instagram: { label: "Instagram", short: "IG", className: "bg-linear-to-br from-amber-400 via-pink-500 to-purple-600 text-white" },
  youtube:   { label: "YouTube",   short: "YT", className: "bg-red-600 text-white" },
  other:     { label: "Enlace",    short: "🔗", className: "bg-muted text-muted-foreground" },
};
