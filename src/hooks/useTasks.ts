import { useState } from "react";
import type { Task } from "@/types";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  function addTask(partial: Partial<Task> & { title: string }) {
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), done: false, ...partial }]);
  }
  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }
  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }
  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }
  // Follows a day swap: scheduled tasks move along with their day's contents.
  function swapTaskDays(aId: string, bId: string) {
    setTasks((prev) => prev.map((t) =>
      t.dayId === aId ? { ...t, dayId: bId } : t.dayId === bId ? { ...t, dayId: aId } : t,
    ));
  }

  return { tasks, setTasks, addTask, toggleTask, updateTask, deleteTask, swapTaskDays };
}
