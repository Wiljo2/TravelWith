import { ITEM_ICONS, DEFAULT_EVENT_ICON } from "@/constants/itemIcons";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT } from "@/constants/taskCategories";
import { asWords } from "@/utils/ideas";

const MATCHERS = Object.values(ITEM_ICONS).map((entry) => ({
  emoji: entry.emoji,
  phrases: entry.keywords.map(asWords),
}));

// Emoji of the first catalog entry whose keyword appears in the title as a whole word or phrase.
export function suggestIcon(title: string): string | null {
  const words = asWords(title);
  if (words.trim() === "") return null;
  return MATCHERS.find((m) => m.phrases.some((p) => words.includes(p)))?.emoji ?? null;
}

export function eventIcon(ev: { title: string; icon?: string | null }): string {
  return ev.icon || suggestIcon(ev.title) || DEFAULT_EVENT_ICON;
}

export function taskIcon(task: { title: string; icon?: string | null; cat?: string }): string {
  const cat = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  return task.icon || suggestIcon(task.title) || cat.icon;
}
