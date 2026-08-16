let _seq = 0;

// Ids must stay unique against payloads persisted by earlier sessions, so they
// can't come from a counter that restarts at 0 on every page load / cold start.
export const uid = (): string =>
  `e${Date.now().toString(36)}${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
