import type { TaskPriority } from "@/types";

export interface TaskCategory {
  label: string;
  icon: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}

// Types of "things to discuss / decide / handle" that a task can be.
export const TASK_CATEGORIES: Record<string, TaskCategory> = {
  decidir:   { label: "Decidir",   icon: "💬", bg: "#EEEDFE", border: "#534AB7", text: "#26215C", dot: "#7F77DD" },
  reservar:  { label: "Reservar",  icon: "📅", bg: "#E6F1FB", border: "#185FA5", text: "#042C53", dot: "#378ADD" },
  comprar:   { label: "Comprar",   icon: "🛒", bg: "#E1F5EE", border: "#0F6E56", text: "#04342C", dot: "#1D9E75" },
  confirmar: { label: "Confirmar", icon: "✅", bg: "#FAEEDA", border: "#854F0B", text: "#412402", dot: "#EF9F27" },
  empacar:   { label: "Empacar",   icon: "🧳", bg: "#FAECE7", border: "#993C1D", text: "#4A1B0C", dot: "#D85A30" },
};

export const DEFAULT_TASK_CAT = "decidir";

export const PRIORITIES: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  alta:  { label: "Alta",  color: "#EF4444", bg: "rgba(239,68,68,.12)" },
  media: { label: "Media", color: "#F59E0B", bg: "rgba(245,158,11,.12)" },
  baja:  { label: "Baja",  color: "#6B7280", bg: "rgba(107,114,128,.12)" },
};

export const PRIORITY_ORDER: TaskPriority[] = ["alta", "media", "baja"];
