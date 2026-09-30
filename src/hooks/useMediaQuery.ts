import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Matches Tailwind's `md` breakpoint: below it the app switches to the phone layout.
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");

// Primary input is a finger: long-press drag replaces HTML5 drag and drop.
export const useIsTouch = () => useMediaQuery("(pointer: coarse)");
