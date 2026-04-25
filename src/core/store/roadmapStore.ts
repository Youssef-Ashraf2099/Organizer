import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaskPriority = "critical" | "high" | "normal" | "low";
export type TaskStatus = "pending" | "in-progress" | "done";

export interface RoadmapTask {
  id: string;
  date: string; // Format: YYYY-MM-DD
  title: string;
  description: string;
  time: string;
  tags: string[];
  color: string;
  priority: TaskPriority;
  status: TaskStatus;
}

interface RoadmapState {
  tasks: RoadmapTask[];
  addTask: (task: Omit<RoadmapTask, "id">) => string;
  updateTask: (id: string, updates: Partial<Omit<RoadmapTask, "id">>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newDate: string) => void;
  toggleStatus: (id: string) => void;
}

const STATUS_CYCLE: TaskStatus[] = ["pending", "in-progress", "done"];

export const useRoadmapStore = create<RoadmapState>()(
  persist(
    (set) => ({
      tasks: [],
      addTask: (task) => {
        const id = crypto.randomUUID();
        set((state) => ({
          tasks: [
            ...state.tasks,
            {
              priority: "normal",
              status: "pending",
              ...task,
              id,
            },
          ],
        }));
        return id;
      },
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),
      moveTask: (id, newDate) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, date: newDate } : t)),
        })),
      toggleStatus: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const currentIndex = STATUS_CYCLE.indexOf(t.status ?? "pending");
            const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
            return { ...t, status: nextStatus };
          }),
        })),
    }),
    {
      name: "omni-roadmap-storage",
    }
  )
);
