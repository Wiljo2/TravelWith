const URL_RE = /https?:\/\/[^\s]+/g;

// Extracts http(s) URLs from free text (notes), de-duplicated, order preserved.
export function extractUrls(text: string | undefined): string[] {
  if (!text) return [];
  const matches = text.match(URL_RE) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,)]+$/, "")))];
}

// Short label for a link chip: the host without "www.".
export function linkLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
