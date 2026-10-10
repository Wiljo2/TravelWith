import type Anthropic from "@anthropic-ai/sdk";
import { DomainError } from "@/server/domain/core";
import { runOp } from "@/server/ops";
import type { OpContext } from "@/server/ops/types";
import { ideasRepo } from "@/server/repo/ideas";
import { videoConfig } from "@/server/video/config";
import { canonicalUrl, detectPlatform, findIdeaUrls } from "@/utils/ideas";
import { rowToIdea, type Row } from "@/utils/tripRows";
import type { Idea } from "@/types";

// The ideas board for the assistant: read what the group saved (with what each
// video shows), and save a new link — its video is then watched automatically.

const MAX_LISTED = 100;

const schema = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: "object" as const, properties, required, additionalProperties: false });

export const IDEA_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_ideas",
    description:
      "List the ideas the group saved (TikToks, reels, YouTube): caption, note, place, type, votes and, when the video was analyzed, its summary and the spots it recommends. Ideas with parentId are the spots of one video. Call this before recommending plans, restaurants or tips from the group's saved videos.",
    input_schema: schema({}),
  },
  {
    name: "add_idea",
    description:
      "Save a TikTok, Instagram or YouTube link to the trip's ideas board. Its video is analyzed automatically in about a minute (summary and spots); you don't need to wait for it. Call when the user shares a video link or asks to save one.",
    input_schema: schema(
      {
        url: { type: "string", description: "The video link exactly as the user gave it" },
        note: { type: "string", description: "Optional: why the user saved it, in their words" },
      },
      ["url"],
    ),
  },
];

export const IDEA_TOOL_LABELS: Record<string, string> = {
  get_ideas: "Revisando las ideas",
  add_idea: "Guardando la idea",
};

const cut = (s: string | undefined, max: number) => (s && s.length > max ? `${s.slice(0, max)}…` : s);

function describe(i: Idea) {
  const v = i.video;
  return {
    id: i.id,
    url: i.url,
    platform: i.platform,
    parentId: i.parentId,
    title: cut(i.title, 160),
    note: i.note,
    place: i.place ?? i.suggestion?.place,
    cat: i.cat ?? i.suggestion?.cat,
    status: i.status ?? "idea",
    votes: i.votes?.length ?? 0,
    spot: i.spot,
    video: v && {
      status: v.status,
      reason: v.status === "done" ? undefined : v.reason,
      relevant: v.relevant,
      summary: cut(v.summary, 400),
      spots: v.spots?.map((s) => [s.name, s.city, s.price].filter(Boolean).join(" · ")),
    },
  };
}

async function listIdeas(code: string): Promise<Idea[]> {
  return (await ideasRepo.list(code)).map((r) => rowToIdea(r as unknown as Row));
}

export function isIdeaTool(name: string): boolean {
  return IDEA_TOOLS.some((t) => t.name === name);
}

export async function runIdeaTool(ctx: OpContext, name: string, input: Record<string, unknown>): Promise<unknown> {
  if (name === "get_ideas") {
    const ideas = (await listIdeas(ctx.code)).filter((i) => i.status !== "discarded");
    return { count: ideas.length, ideas: ideas.slice(0, MAX_LISTED).map(describe) };
  }

  const url = typeof input.url === "string" ? findIdeaUrls(input.url)[0] : undefined;
  if (!url) throw new DomainError("That is not a TikTok, Instagram, YouTube or web link.");
  const existing = (await listIdeas(ctx.code)).find((i) => !i.parentId && canonicalUrl(i.url) === canonicalUrl(url));
  if (existing) return { ok: true, alreadySaved: true, idea: describe(existing) };

  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 500) : undefined;
  const idea = { url, platform: detectPlatform(url), createdAt: new Date().toISOString(), status: "idea", ...(note ? { note } : {}) };
  const result = await runOp("idea.create", ctx, { args: { idea } });
  const id = result.changed[0]?.row.id;
  return { ok: true, id, url, analyzingVideo: videoConfig().enabled && idea.platform !== "other" };
}
