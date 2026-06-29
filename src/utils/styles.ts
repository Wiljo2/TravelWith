import type { CSSProperties } from 'react';

export function inputStyle(extra: CSSProperties = {}): CSSProperties {
  return {
    border: "1px solid var(--border-strong)",
    borderRadius: 6,
    padding: "5px 7px",
    fontSize: 12.5,
    fontFamily: "inherit",
    color: "var(--text-primary)",
    background: "var(--surface-1)",
    outline: "none",
    ...extra,
  };
}
