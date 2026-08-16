// `body { zoom: var(--app-zoom) }` (globals.css) shrinks the whole UI. Client
// coordinates — clientX/clientY, getBoundingClientRect — come back in that
// scaled space, while layout constants (PX_PER_HOUR, GUTTER_W, modal sizes) are
// plain CSS pixels. Any math mixing the two must divide by this factor first.

let cachedRoot: number | null = null;

export function rootZoom(): number {
  if (cachedRoot !== null) return cachedRoot;
  if (typeof window === "undefined") return 1;
  const value = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-zoom")
  );
  cachedRoot = Number.isFinite(value) && value > 0 ? value : 1;
  return cachedRoot;
}

export function cssZoom(el: HTMLElement | null): number {
  const native = (el as (HTMLElement & { currentCSSZoom?: number }) | null)?.currentCSSZoom;
  if (typeof native === "number" && native > 0) return native;
  return rootZoom();
}
