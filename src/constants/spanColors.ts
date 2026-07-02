export const SPAN_COLORS = [
  { id: "azul",    label: "Azul",    bg: "rgba(59,130,246,.14)",  border: "rgba(59,130,246,.65)"  },
  { id: "verde",   label: "Verde",   bg: "rgba(34,197,94,.13)",   border: "rgba(34,197,94,.60)"   },
  { id: "naranja", label: "Naranja", bg: "rgba(249,115,22,.13)",  border: "rgba(249,115,22,.65)"  },
  { id: "morado",  label: "Morado",  bg: "rgba(168,85,247,.12)",  border: "rgba(168,85,247,.60)"  },
  { id: "amarillo",label: "Amarillo",bg: "rgba(234,179,8,.14)",   border: "rgba(234,179,8,.65)"   },
  { id: "rojo",    label: "Rojo",    bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.60)"   },
  { id: "cyan",    label: "Cyan",    bg: "rgba(6,182,212,.13)",   border: "rgba(6,182,212,.60)"   },
] as const;

export type SpanColor = (typeof SPAN_COLORS)[number];
