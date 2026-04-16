import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RoadmapTask {
  id: string;
  date: string; // Format: YYYY-MM-DD
  title: string;
  description: string;
  time: string;
  tags: string[];
  color: string;
}

interface RoadmapState {
  tasks: RoadmapTask[];
  addTask: (task: Omit<RoadmapTask, "id">) => string;
  updateTask: (id: string, updates: Partial<Omit<RoadmapTask, "id">>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newDate: string) => void;
}

export const useRoadmapStore = create<RoadmapState>()(
  persist(
    (set) => ({
      tasks: [],
      addTask: (task) => {
        const id = crypto.randomUUID();
        set((state) => ({
          tasks: [...state.tasks, { ...task, id }],
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
    }),
    {
      name: "omni-roadmap-storage",
    }
  )
);
