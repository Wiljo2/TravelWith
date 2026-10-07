// Trip map: one color per itinerary day, for pins, routes and day chips.
export const DAY_COLORS = ["#0f766e", "#c2410c", "#7c3aed", "#be123c", "#1d4ed8", "#a16207", "#15803d", "#db2777", "#0369a1", "#4d7c0f"];

export const dayColor = (idx: number) => DAY_COLORS[idx % DAY_COLORS.length];
