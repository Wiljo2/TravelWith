import { createContext, useContext } from "react";
import { DEFAULT_VIEW_START, HOUR_START } from "@/constants/time";
import type { Day, Task } from "@/types";

// The calendar opens at DEFAULT_VIEW_START and only grows upward when an
// activity or task starts earlier, so empty early-morning rows aren't drawn.
export function calendarStartHour(days: Day[], tasks: Task[]): number {
  const starts = [
    ...days.flatMap((d) => d.events.map((e) => e.start)),
    ...tasks.flatMap((t) => (t.start != null ? [t.start] : [])),
  ];
  return Math.max(HOUR_START, Math.floor(Math.min(DEFAULT_VIEW_START, ...starts)));
}

export const GridStartContext = createContext(DEFAULT_VIEW_START);

export const useGridStart = () => useContext(GridStartContext);
