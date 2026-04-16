import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ObjectiveStatus = "active" | "completed" | "abandoned";
export type ObjectiveRepeatPattern = "daily" | "weekly" | "monthly";

export interface ObjectiveChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  linkedTodoId?: string;
  linkedSubtaskId?: string;
  orphaned?: boolean;
}

export interface ObjectiveEntry {
  id: string;
  title: string;
  description?: string;
  isCritical: boolean;
  status: ObjectiveStatus;
  objectiveDate: string;
  createdAt: string;
  updatedAt: string;
  checklistItems: ObjectiveChecklistItem[];
  startTime?: string; // HH:mm format
  estimatedEndTime?: string; // HH:mm format
  reminderAt?: string; // datetime-local value
  repeatEnabled?: boolean;
  repeatPattern?: ObjectiveRepeatPattern;
  repeatSeriesId?: string;
  repeatStartDate?: string;
  emoji?: string; // Optional emoji for visual appeal
}

type TodoLike = {
  id: string;
  subtasks?: { id: string; title: string; completed: boolean }[];
};

interface ObjectiveState {
  objectives: ObjectiveEntry[];
  addObjective: (input: {
    title: string;
    description?: string;
    isCritical?: boolean;
    objectiveDate?: string;
    startTime?: string;
    estimatedEndTime?: string;
    reminderAt?: string;
    repeatEnabled?: boolean;
    repeatPattern?: ObjectiveRepeatPattern;
    emoji?: string;
  }) => string;
  removeObjective: (id: string) => void;
  removeObjectivesForDate: (date: string) => void;
  clearHistoryBeforeDate: (date: string) => void;
  clearAllObjectives: () => void;
  archiveObjective: (id: string) => void;
  setStatus: (id: string, status: ObjectiveStatus) => void;
  setCritical: (id: string, isCritical: boolean) => void;
  setTimeline: (
    id: string,
    startTime?: string,
    estimatedEndTime?: string,
  ) => void;
  setRecurrence: (
    id: string,
    repeatEnabled: boolean,
    repeatPattern?: ObjectiveRepeatPattern,
  ) => void;
  setEmoji: (id: string, emoji?: string) => void;
  addChecklistItem: (
    objectiveId: string,
    input: {
      text: string;
      linkedTodoId?: string;
      linkedSubtaskId?: string;
    },
  ) => void;
  toggleChecklistItem: (
    objectiveId: string,
    itemId: string,
    completed?: boolean,
  ) => void;
  removeChecklistItem: (objectiveId: string, itemId: string) => void;
  updateChecklistItemText: (
    objectiveId: string,
    itemId: string,
    text: string,
  ) => void;
  getObjectivesForDate: (date: string) => ObjectiveEntry[];
  ensureRecurringObjectivesForDate: (date: string) => void;
  reconcileWithTodos: (todos: TodoLike[]) => void;
}

const shouldOccurOnDate = (
  startDate: string,
  targetDate: string,
  pattern: ObjectiveRepeatPattern,
) => {
  if (targetDate < startDate) return false;

  if (pattern === "daily") return true;

  const start = new Date(`${startDate}T00:00`);
  const target = new Date(`${targetDate}T00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime())) {
    return false;
  }

  if (pattern === "weekly") {
    const diffDays = Math.floor(
      (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays % 7 === 0;
  }

  // Monthly recurrence based on day-of-month.
  return start.getDate() === target.getDate();
};

const copyReminderDate = (
  reminderAt: string | undefined,
  targetDate: string,
) => {
  if (!reminderAt) return undefined;
  const [, timePart] = reminderAt.split("T");
  if (!timePart) return undefined;
  return `${targetDate}T${timePart.slice(0, 5)}`;
};

const todayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const recalcStatus = (entry: ObjectiveEntry): ObjectiveEntry => {
  if (entry.status === "abandoned") return entry;
  if (entry.checklistItems.length === 0) {
    return {
      ...entry,
      status: entry.status === "completed" ? "completed" : "active",
    };
  }
  const allDone = entry.checklistItems.every((i) => i.completed);
  return { ...entry, status: allDone ? "completed" : "active" };
};

export const useObjectiveStore = create<ObjectiveState>()(
  persist(
    (set, get) => ({
      objectives: [],

      addObjective: (input) => {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const objectiveDate = input.objectiveDate || todayKey();
        const repeatEnabled = Boolean(input.repeatEnabled);
        const entry: ObjectiveEntry = {
          id,
          title: input.title.trim(),
          description: input.description?.trim() || undefined,
          isCritical: Boolean(input.isCritical),
          status: "active",
          objectiveDate,
          createdAt: now,
          updatedAt: now,
          checklistItems: [],
          startTime: input.startTime,
          estimatedEndTime: input.estimatedEndTime,
          reminderAt: input.reminderAt,
          repeatEnabled,
          repeatPattern: input.repeatPattern || "weekly",
          repeatSeriesId: id,
          repeatStartDate: objectiveDate,
          emoji: input.emoji,
        };

        set((state) => ({ objectives: [entry, ...state.objectives] }));
        return id;
      },

      removeObjective: (id) => {
        set((state) => ({
          objectives: state.objectives.filter((o) => o.id !== id),
        }));
      },

      removeObjectivesForDate: (date) => {
        set((state) => ({
          objectives: state.objectives.filter((o) => o.objectiveDate !== date),
        }));
      },

      clearHistoryBeforeDate: (date) => {
        set((state) => ({
          objectives: state.objectives.filter((o) => o.objectiveDate >= date),
        }));
      },

      clearAllObjectives: () => {
        set({ objectives: [] });
      },

      archiveObjective: (id) => {
        set((state) => ({
          objectives: state.objectives.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: "abandoned",
                  updatedAt: new Date().toISOString(),
                }
              : o,
          ),
        }));
      },

      setStatus: (id, status) => {
        set((state) => ({
          objectives: state.objectives.map((o) =>
            o.id === id
              ? recalcStatus({
                  ...o,
                  status,
                  updatedAt: new Date().toISOString(),
                })
              : o,
          ),
        }));
      },

      setCritical: (id, isCritical) => {
        set((state) => ({
          objectives: state.objectives.map((o) =>
            o.id === id
              ? { ...o, isCritical, updatedAt: new Date().toISOString() }
              : o,
          ),
        }));
      },

      setTimeline: (id, startTime, estimatedEndTime) => {
        set((state) => ({
          objectives: state.objectives.map((o) =>
            o.id === id
              ? {
                  ...o,
                  startTime,
                  estimatedEndTime,
                  updatedAt: new Date().toISOString(),
                }
              : o,
          ),
        }));
      },

      setRecurrence: (id, repeatEnabled, repeatPattern) => {
        set((state) => ({
          objectives: state.objectives.map((o) => {
            if (o.id !== id) return o;
            return {
              ...o,
              repeatEnabled,
              repeatPattern: repeatPattern || o.repeatPattern || "weekly",
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      setEmoji: (id, emoji) => {
        set((state) => ({
          objectives: state.objectives.map((o) =>
            o.id === id
              ? { ...o, emoji, updatedAt: new Date().toISOString() }
              : o,
          ),
        }));
      },

      addChecklistItem: (objectiveId, input) => {
        if (!input.text.trim()) return;
        const now = new Date().toISOString();

        set((state) => ({
          objectives: state.objectives.map((o) => {
            if (o.id !== objectiveId) return o;
            const next = {
              ...o,
              updatedAt: now,
              checklistItems: [
                ...o.checklistItems,
                {
                  id: crypto.randomUUID(),
                  text: input.text.trim(),
                  completed: false,
                  linkedTodoId: input.linkedTodoId,
                  linkedSubtaskId: input.linkedSubtaskId,
                  orphaned: false,
                },
              ],
            };
            return recalcStatus(next);
          }),
        }));
      },

      toggleChecklistItem: (objectiveId, itemId, completed) => {
        const now = new Date().toISOString();
        set((state) => ({
          objectives: state.objectives.map((o) => {
            if (o.id !== objectiveId) return o;
            const next = {
              ...o,
              updatedAt: now,
              checklistItems: o.checklistItems.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      completed:
                        typeof completed === "boolean"
                          ? completed
                          : !item.completed,
                    }
                  : item,
              ),
            };
            return recalcStatus(next);
          }),
        }));
      },

      removeChecklistItem: (objectiveId, itemId) => {
        const now = new Date().toISOString();
        set((state) => ({
          objectives: state.objectives.map((o) => {
            if (o.id !== objectiveId) return o;
            const next = {
              ...o,
              updatedAt: now,
              checklistItems: o.checklistItems.filter((i) => i.id !== itemId),
            };
            return recalcStatus(next);
          }),
        }));
      },

      updateChecklistItemText: (objectiveId, itemId, text) => {
        const clean = text.trim();
        if (!clean) return;
        const now = new Date().toISOString();
        set((state) => ({
          objectives: state.objectives.map((o) => {
            if (o.id !== objectiveId) return o;
            return {
              ...o,
              updatedAt: now,
              checklistItems: o.checklistItems.map((i) =>
                i.id === itemId ? { ...i, text: clean } : i,
              ),
            };
          }),
        }));
      },

      getObjectivesForDate: (date) =>
        get()
          .objectives.filter((o) => o.objectiveDate === date)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      ensureRecurringObjectivesForDate: (date) => {
        const objectives = get().objectives;

        const bySeries = new Map<string, ObjectiveEntry[]>();
        objectives.forEach((objective) => {
          const seriesId = objective.repeatSeriesId || objective.id;
          const group = bySeries.get(seriesId) || [];
          group.push(objective);
          bySeries.set(seriesId, group);
        });

        const toAdd: ObjectiveEntry[] = [];

        bySeries.forEach((group, seriesId) => {
          const sorted = [...group].sort((a, b) =>
            a.objectiveDate.localeCompare(b.objectiveDate),
          );
          const latest = sorted[sorted.length - 1];
          const startDate = latest.repeatStartDate || sorted[0].objectiveDate;

          const alreadyExists = sorted.some((o) => o.objectiveDate === date);
          if (alreadyExists) return;
          if (!latest.repeatEnabled || !latest.repeatPattern) return;
          if (!shouldOccurOnDate(startDate, date, latest.repeatPattern)) return;
          if (date <= latest.objectiveDate) return;

          const now = new Date().toISOString();
          const clonedChecklist = latest.checklistItems.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
            completed: false,
          }));

          toAdd.push({
            ...latest,
            id: crypto.randomUUID(),
            objectiveDate: date,
            status: "active",
            checklistItems: clonedChecklist,
            reminderAt: copyReminderDate(latest.reminderAt, date),
            createdAt: now,
            updatedAt: now,
            repeatSeriesId: seriesId,
            repeatStartDate: startDate,
          });
        });

        if (toAdd.length === 0) return;

        set((state) => ({
          objectives: [...toAdd, ...state.objectives],
        }));
      },

      reconcileWithTodos: (todos) => {
        const todoMap = new Map(todos.map((t) => [t.id, t]));

        set((state) => ({
          objectives: state.objectives.map((objective) => {
            const updatedItems = objective.checklistItems.map((item) => {
              if (!item.linkedTodoId || !item.linkedSubtaskId) {
                return { ...item, orphaned: false };
              }

              const todo = todoMap.get(item.linkedTodoId);
              if (!todo) {
                return { ...item, orphaned: true };
              }

              const subtask = todo.subtasks?.find(
                (sub) => sub.id === item.linkedSubtaskId,
              );

              if (!subtask) {
                return { ...item, orphaned: true };
              }

              return {
                ...item,
                text: subtask.title,
                completed: subtask.completed,
                orphaned: false,
              };
            });

            return recalcStatus({
              ...objective,
              checklistItems: updatedItems,
            });
          }),
        }));
      },
    }),
    {
      name: "omni-objective-storage",
    },
  ),
);

export const getTodayObjectiveStats = (entries: ObjectiveEntry[]) => {
  const total = entries.length;
  const completed = entries.filter((o) => o.status === "completed").length;
  const critical = entries.filter((o) => o.isCritical).length;
  const criticalCompleted = entries.filter(
    (o) => o.isCritical && o.status === "completed",
  ).length;
  const checklistTotal = entries.reduce(
    (acc, o) => acc + o.checklistItems.length,
    0,
  );
  const checklistDone = entries.reduce(
    (acc, o) => acc + o.checklistItems.filter((i) => i.completed).length,
    0,
  );

  return {
    total,
    completed,
    critical,
    criticalCompleted,
    checklistTotal,
    checklistDone,
    completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
};
