"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { DESTINATION, TRAVELERS, VIEW_CENTER } from "@/components/landing/globe/trip";
import { cn } from "@/lib/utils";

// three.js loads only once the landing is idle and is skipped when the visitor
// is headed into the app. Until then (or without WebGL) a flat globe holds the spot.
export function HeroGlobe({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || document.documentElement.dataset.entry === "app") return;
    let cancelled = false;
    let dispose: (() => void) | null = null;

    const start = () => {
      import("@/components/landing/globe/scene")
        .then(({ createGlobeScene }) => {
          if (cancelled) return;
          const css = getComputedStyle(document.documentElement);
          const token = (name: string) => css.getPropertyValue(name).trim();
          dispose = createGlobeScene({
            host,
            center: VIEW_CENTER,
            destination: DESTINATION,
            routes: TRAVELERS.map((t) => ({ from: t.from, color: token(t.color) })),
            palette: {
              body: token("--card"),
              rim: token("--primary"),
              dots: token("--accent-foreground"),
              halo: token("--primary"),
              destination: token("--ring"),
            },
            still: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            onFrame: (anchors) =>
              anchors.forEach((a, i) => {
                const label = labelRefs.current[i];
                if (!label) return;
                label.style.transform = `translate3d(${a.x}px, ${a.y}px, 0)`;
                label.style.opacity = String(a.opacity);
              }),
            onReady: () => setReady(true),
          });
        })
        .catch(() => {});
    };

    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle ? window.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 150);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      dispose?.();
    };
  }, []);

  return (
    <div aria-hidden className={cn("relative aspect-square w-full select-none", className)}>
      <div
        className={cn(
          "absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_38%_32%,var(--card)_55%,var(--accent))] shadow-[0_0_0_1px_var(--border),0_40px_90px_-30px_var(--primary)] transition-opacity duration-700",
          ready && "opacity-0",
        )}
      />
      <div
        ref={hostRef}
        className={cn(
          "absolute inset-0 cursor-grab touch-pan-y opacity-0 transition-opacity duration-1000 active:cursor-grabbing [&>canvas]:block [&>canvas]:size-full",
          ready && "opacity-100",
        )}
      />
      <div className="pointer-events-none absolute inset-0">
        {TRAVELERS.map((t, i) => (
          <div
            key={t.initial}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="absolute top-0 left-0 opacity-0 will-change-transform"
          >
            <span className="flex -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-1.5 rounded-full border border-border bg-card/90 py-0.5 pr-2.5 pl-0.5 text-[11px] font-medium whitespace-nowrap shadow-sm backdrop-blur-sm">
              <span
                className="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: `var(${t.color})` }}
              >
                {t.initial}
              </span>
              {t.city}
            </span>
          </div>
        ))}
        <div
          ref={(el) => {
            labelRefs.current[TRAVELERS.length] = el;
          }}
          className="absolute top-0 left-0 opacity-0 will-change-transform"
        >
          <span className="flex -translate-x-1/2 -translate-y-[calc(100%+14px)] items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-background shadow-md">
            <MapPin className="size-3.5" aria-hidden />
            {DESTINATION.name}
          </span>
        </div>
      </div>
    </div>
  );
}
