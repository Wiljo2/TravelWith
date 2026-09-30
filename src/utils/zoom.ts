// `body { zoom: var(--app-zoom) }` (globals.css) shrinks the whole UI. Client
// coordinates — clientX/clientY, getBoundingClientRect — come back in that
// scaled space, while layout constants (PX_PER_HOUR, GUTTER_W, modal sizes) are
// plain CSS pixels. Any math mixing the two must divide by this factor first.

// Not cached: --app-zoom changes with the viewport width (1 on phones, 0.85 on desktop).
export function rootZoom(): number {
  if (typeof window === "undefined") return 1;
  const value = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-zoom")
  );
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function cssZoom(el: HTMLElement | null): number {
  const native = (el as (HTMLElement & { currentCSSZoom?: number }) | null)?.currentCSSZoom;
  if (typeof native === "number" && native > 0) return native;
  return rootZoom();
}
