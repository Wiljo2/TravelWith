import { normalizeText } from "@/utils/ideas";

// Automatic transcripts are long and repetitive, and most of a video is filler
// ("hola chicos, sígueme para más"). To keep an AI prompt cheap, this keeps the
// opening (where the video says what it's about) and the passages that mention
// the trip's places or plan, in their original order, within `maxChars`.

const WINDOW = 25;   // words per passage (ASR text has no reliable punctuation)

export function transcriptExcerpt(transcript: string, keywords: Set<string>, maxChars = 700): string {
  const words = dedupeRuns(transcript.split(/\s+/).filter(Boolean));
  const full = words.join(" ");
  if (full.length <= maxChars) return full;

  const passages: { idx: number; text: string; score: number; words: string[]; first: number }[] = [];
  for (let i = 0; i < words.length; i += WINDOW) {
    const chunk = words.slice(i, i + WINDOW);
    const isHit = chunk.map((w) => keywords.has(normalizeText(w).replace(/[^a-z0-9ñ]/g, "")));
    const hits = new Set(chunk.filter((_, j) => isHit[j]).map((w) => normalizeText(w)));
    passages.push({ idx: passages.length, text: chunk.join(" "), score: hits.size, words: chunk, first: isHit.indexOf(true) });
  }
  // The opening always goes in (shortened if the budget is tight); then the
  // passages with most plan words — trimmed around the match when they don't fit.
  const MIN_PASSAGE = 60;
  const picked = new Set([0]);
  if (passages[0].text.length > maxChars / 2) passages[0].text = `${passages[0].text.slice(0, Math.floor(maxChars / 2))}`;
  let used = passages[0].text.length;
  for (const p of [...passages.slice(1)].filter((p) => p.score > 0).sort((a, b) => b.score - a.score || a.idx - b.idx)) {
    const room = maxChars - used - 3;
    if (room < MIN_PASSAGE) break;
    if (p.text.length > room) {
      let from = Math.max(0, p.first - 3);
      let text = p.words.slice(from).join(" ");
      while (text.length > room && from < p.first) text = p.words.slice(++from).join(" ");
      p.text = text.length > room ? text.slice(0, room) : text;
    }
    picked.add(p.idx);
    used += p.text.length + 3;
  }
  let out = "";
  let prev = -1;
  for (const p of passages) {
    if (!picked.has(p.idx)) continue;
    out += (prev === -1 ? "" : p.idx === prev + 1 ? " " : " … ") + p.text;
    prev = p.idx;
  }
  return out.length > maxChars ? `${out.slice(0, maxChars)}…` : `${out}${prev < passages.length - 1 ? " …" : ""}`;
}

// "el el precio precio es" → "el precio es" (captions repeat words across cues).
function dedupeRuns(words: string[]): string[] {
  return words.filter((w, i) => i === 0 || normalizeText(w) !== normalizeText(words[i - 1]));
}
