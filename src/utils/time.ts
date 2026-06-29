export function fmtHour(h: number): string {
  const norm = ((h % 24) + 24) % 24;
  let hh = Math.floor(norm);
  const mm = Math.round((norm - hh) * 60);
  const ampm = hh >= 12 ? "pm" : "am";
  let disp = hh % 12;
  if (disp === 0) disp = 12;
  return `${disp}:${mm.toString().padStart(2, "0")} ${ampm}`;
}

export function snapHour(hour: number, dur: number, hourStart: number, hourEnd: number): number {
  const s = Math.round(hour * 4) / 4;
  return Math.max(hourStart, Math.min(s, hourEnd - Math.max(dur, 0.25)));
}

export function durLabel(start: number, end: number): string {
  const d = end - start;
  if (d <= 0) return "puntual";
  const hh = Math.floor(d);
  const mm = Math.round((d - hh) * 60);
  if (hh && mm) return `${hh}h ${mm}m`;
  if (hh) return `${hh}h`;
  return `${mm}m`;
}
