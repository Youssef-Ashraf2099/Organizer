import { useEffect, useMemo, useState } from "react";
import { FaBullseye } from "@react-icons/all-files/fa/FaBullseye";
import { FaFlag } from "@react-icons/all-files/fa/FaFlag";
import { FaLink } from "@react-icons/all-files/fa/FaLink";
import { FaExclamationTriangle } from "@react-icons/all-files/fa/FaExclamationTriangle";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaClock } from "@react-icons/all-files/fa/FaClock";
import { FaFire } from "@react-icons/all-files/fa/FaFire";
import { FaCheckCircle } from "@react-icons/all-files/fa/FaCheckCircle";
import { FaStar } from "@react-icons/all-files/fa/FaStar";
import { FaHistory } from "@react-icons/all-files/fa/FaHistory";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import {
  getTodayObjectiveStats,
  ObjectiveRepeatPattern,
  useObjectiveStore,
} from "../../core/store/objectiveStore";
import { notificationService } from "../../core/services/notificationService";
import { useNotificationStore } from "../../core/store/notificationStore";

type TodoLike = {
  id: string;
  title: string;
  column: "backlog" | "todo" | "inprogress" | "done";
  subtasks?: { id: string; title: string; completed: boolean }[];
};

const getTodayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const loadTodos = (): TodoLike[] => {
  try {
    const raw = localStorage.getItem("personal-todos");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveTodos = (todos: TodoLike[]) => {
  localStorage.setItem("personal-todos", JSON.stringify(todos));
  const counts = todos.reduce(
    (acc, todo) => {
      acc[todo.column] += 1;
      return acc;
    },
    { backlog: 0, todo: 0, inprogress: 0, done: 0 },
  );
  window.dispatchEvent(
    new CustomEvent("todoCountsUpdated", { detail: { counts } }),
  );
  window.dispatchEvent(
    new CustomEvent("todoExternalUpdate", { detail: { todos } }),
  );
  window.dispatchEvent(new CustomEvent("todosUpdated", { detail: { todos } }));
};

export const TodayObjective = () => {
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  const [todoList, setTodoList] = useState<TodoLike[]>([]);
  const [newObjectiveTitle, setNewObjectiveTitle] = useState("");
  const [newObjectiveDesc, setNewObjectiveDesc] = useState("");
  const [criticalNewObjective, setCriticalNewObjective] = useState(false);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newReminderAt, setNewReminderAt] = useState("");
  const [newRepeatEnabled, setNewRepeatEnabled] = useState(false);
  const [newRepeatPattern, setNewRepeatPattern] =
    useState<ObjectiveRepeatPattern>("weekly");
  const [newCategory, setNewCategory] = useState<string>("work");
  const [selectedTodoId, setSelectedTodoId] = useState("");
  const [selectedSubtaskId, setSelectedSubtaskId] = useState("");
  const [manualChecklistText, setManualChecklistText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(
    null,
  );

  const today = getTodayKey();

  // Category definitions with emojis and colors
  const categories = {
    work: { emoji: "💼", label: "Work", color: "#3b82f6" },
    university: { emoji: "🎓", label: "University", color: "#8b5cf6" },
    meeting: { emoji: "👥", label: "Meeting", color: "#06b6d4" },
    personal: { emoji: "🏠", label: "Personal", color: "#10b981" },
    health: { emoji: "💪", label: "Health & Fitness", color: "#ef4444" },
    learning: { emoji: "📚", label: "Learning", color: "#f59e0b" },
    creative: { emoji: "🎨", label: "Creative", color: "#ec4899" },
    social: { emoji: "🎉", label: "Social & Hangout", color: "#14b8a6" },
    gaming: { emoji: "🎮", label: "Gaming", color: "#a855f7" },
    shopping: { emoji: "🛍️", label: "Shopping", color: "#f97316" },
    family: { emoji: "👨‍👩‍👧‍👦", label: "Family Time", color: "#22c55e" },
    hobby: { emoji: "⚡", label: "Hobby", color: "#6366f1" },
    other: { emoji: "🎯", label: "Other", color: "#64748b" },
  };

  // Subscribe to raw store to avoid infinite loops from selector returning new array ref
  const allObjectives = useObjectiveStore((s) => s.objectives);
  const addObjective = useObjectiveStore((s) => s.addObjective);
  const addChecklistItem = useObjectiveStore((s) => s.addChecklistItem);
  const toggleChecklistItem = useObjectiveStore((s) => s.toggleChecklistItem);
  const updateChecklistItemText = useObjectiveStore(
    (s) => s.updateChecklistItemText,
  );
  const removeChecklistItem = useObjectiveStore((s) => s.removeChecklistItem);
  const removeObjective = useObjectiveStore((s) => s.removeObjective);
  const removeObjectivesForDate = useObjectiveStore(
    (s) => s.removeObjectivesForDate,
  );
  const clearHistoryBeforeDate = useObjectiveStore(
    (s) => s.clearHistoryBeforeDate,
  );
  const clearAllObjectives = useObjectiveStore((s) => s.clearAllObjectives);
  const setStatus = useObjectiveStore((s) => s.setStatus);
  const setCritical = useObjectiveStore((s) => s.setCritical);
  const setRecurrence = useObjectiveStore((s) => s.setRecurrence);
  const ensureRecurringObjectivesForDate = useObjectiveStore(
    (s) => s.ensureRecurringObjectivesForDate,
  );
  const reconcileWithTodos = useObjectiveStore((s) => s.reconcileWithTodos);

  const REPEAT_PATTERNS: {
    value: ObjectiveRepeatPattern;
    label: string;
  }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  const objectives = useMemo(
    () => allObjectives.filter((obj) => obj.objectiveDate === today),
    [allObjectives, today],
  );
  const stats = useMemo(() => getTodayObjectiveStats(objectives), [objectives]);
  const historyObjectives = useMemo(
    () =>
      allObjectives
        .filter((obj) => obj.objectiveDate !== today)
        .sort((a, b) => b.objectiveDate.localeCompare(a.objectiveDate)),
    [allObjectives, today],
  );
  const historyByDate = useMemo(() => {
    return historyObjectives.reduce<Record<string, typeof historyObjectives>>(
      (acc, objective) => {
        if (!acc[objective.objectiveDate]) {
          acc[objective.objectiveDate] = [];
        }
        acc[objective.objectiveDate].push(objective);
        return acc;
      },
      {},
    );
  }, [historyObjectives]);

  const sortedObjectives = useMemo(
    () =>
      [...objectives].sort((a, b) => {
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        return 0;
      }),
    [objectives],
  );

  const selectedObjective = useMemo(
    () => objectives.find((obj) => obj.id === selectedObjectiveId) || null,
    [objectives, selectedObjectiveId],
  );

  // Load todos on mount and reconcile ONCE
  useEffect(() => {
    const todos = loadTodos();
    setTodoList(todos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Materialize recurring objectives for today.
  useEffect(() => {
    ensureRecurringObjectivesForDate(today);
  }, [today, ensureRecurringObjectivesForDate]);

  // Reconcile whenever todos change
  useEffect(() => {
    reconcileWithTodos(todoList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoList]);

  useEffect(() => {
    const onTodosUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ todos?: TodoLike[] }>;
      const todos = custom.detail?.todos || loadTodos();
      setTodoList(todos);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "personal-todos") {
        const todos = loadTodos();
        setTodoList(todos);
      }
    };

    window.addEventListener("todosUpdated", onTodosUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("todosUpdated", onTodosUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [reconcileWithTodos]);

  const selectedTodo = todoList.find((t) => t.id === selectedTodoId);

  // Ensure reminders exist for objective occurrences (including auto-generated recurring ones).
  useEffect(() => {
    const { notifications } = useNotificationStore.getState();

    objectives.forEach((objective) => {
      if (!objective.reminderAt) return;

      const alreadyScheduled = notifications.some(
        (n) => n.linkedId === objective.id && n.type === "task_reminder",
      );

      if (alreadyScheduled) return;

      notificationService.scheduleReminder({
        type: "task_reminder",
        title: `🎯 Objective Reminder: ${objective.title}`,
        body: objective.description || `Time to focus on "${objective.title}"`,
        scheduledAt: new Date(objective.reminderAt).toISOString(),
        linkedId: objective.id,
      });
    });
  }, [objectives]);

  const getMotivationalMessage = () => {
    const percent = stats.completionPercent;
    if (stats.total === 0) return "🌟 Start your day with a clear objective!";
    if (percent === 100)
      return "🎉 Incredible! You crushed all your objectives!";
    if (percent >= 75) return "🔥 You're on fire! Keep that momentum going!";
    if (percent >= 50) return "💪 Great progress! You're over halfway there!";
    if (percent >= 25) return "✨ Nice start! Keep pushing forward!";
    return "🚀 Let's make today count! Start checking off those tasks!";
  };

  const createObjective = () => {
    if (!newObjectiveTitle.trim()) return;
    const objectiveId = addObjective({
      title: newObjectiveTitle,
      description: newObjectiveDesc,
      isCritical: criticalNewObjective,
      objectiveDate: today,
      startTime: newStartTime || undefined,
      estimatedEndTime: newEndTime || undefined,
      reminderAt: newReminderAt || undefined,
      repeatEnabled: newRepeatEnabled,
      repeatPattern: newRepeatPattern,
      emoji: categories[newCategory as keyof typeof categories].emoji,
    });

    if (newReminderAt) {
      notificationService.scheduleReminder({
        type: "task_reminder",
        title: `🎯 Objective Reminder: ${newObjectiveTitle.trim()}`,
        body:
          newObjectiveDesc.trim() ||
          `Time to focus on "${newObjectiveTitle.trim()}"`,
        scheduledAt: new Date(newReminderAt).toISOString(),
        linkedId: objectiveId,
      });
    }

    setNewObjectiveTitle("");
    setNewObjectiveDesc("");
    setCriticalNewObjective(false);
    setNewStartTime("");
    setNewEndTime("");
    setNewReminderAt("");
    setNewRepeatEnabled(false);
    setNewRepeatPattern("weekly");
    setNewCategory("work");
    setShowForm(false);
  };

  const addManualChecklist = (objectiveId: string) => {
    if (!manualChecklistText.trim()) return;
    addChecklistItem(objectiveId, { text: manualChecklistText });
    setManualChecklistText("");
  };

  const addFromTodo = (objectiveId: string) => {
    if (!selectedTodoId) return;

    const todo = todoList.find((t) => t.id === selectedTodoId);
    if (!todo) return;

    if (selectedSubtaskId) {
      const subtask = todo.subtasks?.find((s) => s.id === selectedSubtaskId);
      if (!subtask) return;
      addChecklistItem(objectiveId, {
        text: subtask.title,
        linkedTodoId: todo.id,
        linkedSubtaskId: subtask.id,
      });
      return;
    }

    addChecklistItem(objectiveId, {
      text: todo.title,
      linkedTodoId: todo.id,
    });
  };

  const toggleItem = (
    objectiveId: string,
    itemId: string,
    nextCompleted: boolean,
    link?: { linkedTodoId?: string; linkedSubtaskId?: string },
  ) => {
    toggleChecklistItem(objectiveId, itemId, nextCompleted);

    if (!link?.linkedTodoId || !link.linkedSubtaskId) return;

    const todos = loadTodos();
    const nextTodos = todos.map((todo) => {
      if (todo.id !== link.linkedTodoId) return todo;
      const subtasks = (todo.subtasks || []).map((subtask) =>
        subtask.id === link.linkedSubtaskId
          ? { ...subtask, completed: nextCompleted }
          : subtask,
      );
      return { ...todo, subtasks };
    });

    saveTodos(nextTodos);
  };

  const quickToggleObjectiveChecklist = (objectiveId: string) => {
    const objective = objectives.find((obj) => obj.id === objectiveId);
    if (!objective) return;

    // No checklist: toggle the objective itself between active/completed.
    if (objective.checklistItems.length === 0) {
      setStatus(
        objectiveId,
        objective.status === "completed" ? "active" : "completed",
      );
      return;
    }

    const shouldComplete = objective.status !== "completed";

    objective.checklistItems.forEach((item) => {
      if (item.completed === shouldComplete) return;
      toggleItem(objectiveId, item.id, shouldComplete, {
        linkedTodoId: item.linkedTodoId,
        linkedSubtaskId: item.linkedSubtaskId,
      });
    });
  };

  const removeHistoryDate = (date: string) => {
    const count = historyByDate[date]?.length || 0;
    if (count === 0) return;
    if (confirm(`Delete ${count} objective(s) from ${date}?`)) {
      (historyByDate[date] || []).forEach((objective) => {
        notificationService.removeRemindersForItem(objective.id);
      });
      removeObjectivesForDate(date);
    }
  };

  const clearAllHistory = () => {
    const count = historyObjectives.length;
    if (count === 0) return;
    if (
      confirm(
        `Delete all ${count} historical objective(s)? Today's objectives will stay.`,
      )
    ) {
      historyObjectives.forEach((objective) => {
        notificationService.removeRemindersForItem(objective.id);
      });
      clearHistoryBeforeDate(today);
    }
  };

  const removeSingleHistoryObjective = (id: string) => {
    if (confirm("Delete this objective from history?")) {
      notificationService.removeRemindersForItem(id);
      removeObjective(id);
    }
  };

  const removeObjectiveWithCleanup = (id: string) => {
    notificationService.removeRemindersForItem(id);
    removeObjective(id);
  };

  const wipeEverything = () => {
    const count = allObjectives.length;
    if (count === 0) return;
    if (
      confirm(
        `Delete ALL ${count} objectives (today + history)? This cannot be undone.`,
      )
    ) {
      allObjectives.forEach((objective) => {
        notificationService.removeRemindersForItem(objective.id);
      });
      clearAllObjectives();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 text-zinc-100">
      {/* Header with Progress */}
      <div className="p-6 border-b border-zinc-800/50 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <FaBullseye className="text-blue-500" size={18} />
            </div>
            <span className="text-zinc-100">
              Today's Objectives
            </span>
          </h2>
          <div className="text-sm font-medium text-zinc-400 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
            {today}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("today")}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              activeTab === "today"
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Today ({objectives.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all inline-flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FaHistory size={11} />
            History ({historyObjectives.length})
          </button>
        </div>

        {/* Large Progress Bar with Animation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-300">
              {getMotivationalMessage()}
            </span>
            <span className="font-bold text-cyan-400">
              {stats.completionPercent}%
            </span>
          </div>
          <div className="relative h-4 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 shadow-inner">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${stats.completionPercent}%`,
                background:
                  stats.completionPercent === 100
                    ? "#10b981"
                    : "#3b82f6",
              }}
            >
              {stats.completionPercent > 10 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 transition-all">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <FaCheckCircle className="text-blue-400" />
              Objectives
            </div>
            <div className="font-bold text-xl text-zinc-100">
              {stats.completed}
              <span className="text-zinc-600 ml-1">/{stats.total}</span>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 transition-all">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <FaFire className="text-rose-400" />
              Critical
            </div>
            <div className="font-bold text-xl text-rose-400">
              {stats.criticalCompleted}
              <span className="text-zinc-600 ml-1">/{stats.critical}</span>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 transition-all">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <FaStar className="text-blue-400" />
              Checklist
            </div>
            <div className="font-bold text-xl text-zinc-100">
              {stats.checklistDone}
              <span className="text-zinc-600 ml-1">/{stats.checklistTotal}</span>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 transition-all">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <FaClock className="text-emerald-400" />
              Progress
            </div>
            <div className="font-bold text-xl text-emerald-400">
              {stats.completionPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Objectives List with Form */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "today" ? (
          <div className="space-y-6">
            {/* Add Task Button (Visible when form is hidden) */}
            {!showForm && !selectedObjectiveId && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
                >
                  <FaPlus size={14} />
                  Add New Task
                </button>
              </div>
            )}

            {/* Create Objective Form (Hidden by default) */}
            {showForm && !selectedObjectiveId && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="text-sm font-bold text-zinc-100 flex items-center gap-2 mb-4">
                  <FaBullseye className="text-blue-500" />
                  Create New Objective
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {categories[newCategory as keyof typeof categories].emoji}
                    </span>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="bg-zinc-900 border-2 border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                      style={{
                        color:
                          categories[newCategory as keyof typeof categories]
                            .color,
                      }}
                    >
                      {Object.entries(categories).map(([key, cat]) => (
                        <option key={key} value={key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={newObjectiveTitle}
                    onChange={(e) => setNewObjectiveTitle(e.target.value)}
                    placeholder="What's your main goal today?"
                    className="flex-1 bg-zinc-900 border-2 border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium placeholder-zinc-500 hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>

                <textarea
                  value={newObjectiveDesc}
                  onChange={(e) => setNewObjectiveDesc(e.target.value)}
                  placeholder="Add details or why this matters (optional)"
                  rows={2}
                  className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl px-4 py-3 text-sm placeholder-zinc-500 resize-none hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                      <FaClock size={10} />
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl px-3 py-2 text-sm hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                      <FaClock size={10} />
                      Estimated End Time
                    </label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl px-3 py-2 text-sm hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                    <FaClock size={10} />
                    Objective Reminder (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={newReminderAt}
                    onChange={(e) => setNewReminderAt(e.target.value)}
                    className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl px-3 py-2 text-sm hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="inline-flex items-center gap-2.5 text-sm font-medium text-zinc-300 cursor-pointer hover:text-cyan-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={newRepeatEnabled}
                      onChange={(e) => setNewRepeatEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-2 border-zinc-700 bg-zinc-900 checked:bg-cyan-500 checked:border-cyan-500"
                    />
                    Repeat this objective
                  </label>
                  <select
                    value={newRepeatPattern}
                    onChange={(e) =>
                      setNewRepeatPattern(
                        e.target.value as ObjectiveRepeatPattern,
                      )
                    }
                    disabled={!newRepeatEnabled}
                    className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {REPEAT_PATTERNS.map((pattern) => (
                      <option key={pattern.value} value={pattern.value}>
                        Repeat {pattern.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="inline-flex items-center gap-2.5 text-sm font-medium text-zinc-300 cursor-pointer hover:text-rose-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={criticalNewObjective}
                      onChange={(e) =>
                        setCriticalNewObjective(e.target.checked)
                      }
                      className="w-4 h-4 rounded border-2 border-zinc-700 bg-zinc-900 checked:bg-rose-500 checked:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all cursor-pointer"
                    />
                    <FaFlag
                      className={
                        criticalNewObjective ? "text-rose-400" : "text-zinc-600"
                      }
                      size={12}
                    />
                    Mark as Critical Priority
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setNewObjectiveTitle("");
                        setNewObjectiveDesc("");
                        setCriticalNewObjective(false);
                        setNewStartTime("");
                        setNewEndTime("");
                        setNewReminderAt("");
                        setNewRepeatEnabled(false);
                        setNewRepeatPattern("weekly");
                        setNewCategory("work");
                      }}
                      className="px-6 py-2.5 text-sm font-medium rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createObjective}
                      disabled={!newObjectiveTitle.trim()}
                      className="px-6 py-2.5 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add Objective
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Objectives List or Detail View */}
            {!selectedObjectiveId ? (
              <>
                {/* Compact List View */}
                <div className="space-y-3">
                  {objectives.length === 0 && !showForm && (
                    <div className="text-center py-16">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl border-2 border-dashed border-zinc-700 mb-4">
                        <FaBullseye className="text-zinc-600" size={32} />
                      </div>
                      <p className="text-zinc-500 font-medium mb-2">
                        No tasks yet
                      </p>
                      <p className="text-sm text-zinc-600">
                        Click the "Add New Task" button to get started!
                      </p>
                    </div>
                  )}

                  {/* Tasks sorted with critical first */}
                  {sortedObjectives.map((objective) => {
                    const checklistProgress =
                      objective.checklistItems.length > 0
                        ? Math.round(
                            (objective.checklistItems.filter((i) => i.completed)
                              .length /
                              objective.checklistItems.length) *
                              100,
                          )
                        : 0;

                    const isDone = objective.status === "completed";
                    const checklistDone = objective.checklistItems.filter(
                      (i) => i.completed,
                    ).length;

                    return (
                      <div
                        key={objective.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedObjectiveId(objective.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedObjectiveId(objective.id);
                          }
                        }}
                        className={`w-full text-left rounded-xl p-5 transition-all border cursor-pointer ${
                          objective.isCritical
                            ? "bg-rose-950/10 border-rose-500/20 hover:border-rose-500/40"
                            : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40"
                        } group`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5">
                            <button
                              type="button"
                              aria-label="Task status indicator"
                              onClick={(e) => {
                                e.stopPropagation();
                                quickToggleObjectiveChecklist(objective.id);
                              }}
                              className={`h-6 w-6 rounded-md border-[1.5px] grid place-items-center transition-all mt-1 ${
                                isDone
                                  ? "bg-blue-500 border-blue-500 text-white"
                                  : "border-zinc-600 text-transparent hover:border-blue-500"
                              }`}
                            >
                              <FaCheckCircle size={12} />
                            </button>
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4
                                className={`font-semibold text-lg md:text-xl text-zinc-100 transition-colors truncate ${
                                  isDone ? "line-through text-zinc-500" : ""
                                }`}
                              >
                                {objective.title}
                              </h4>

                              {objective.isCritical && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 text-[11px] font-semibold border border-rose-500/20">
                                  <FaFire size={10} />
                                  CRITICAL
                                </span>
                              )}

                              {objective.repeatEnabled &&
                                objective.repeatPattern && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[11px] font-semibold border border-blue-500/20">
                                    🔄 {objective.repeatPattern}
                                  </span>
                                )}
                            </div>

                            {objective.description && (
                              <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2 pr-2">
                                {objective.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-800/70 border border-zinc-700/70 text-zinc-200">
                                <span className="text-sm">
                                  {objective.emoji || "🎯"}
                                </span>
                                Task
                              </span>

                              {(objective.startTime ||
                                objective.estimatedEndTime) && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-800/70 border border-zinc-700/70 text-zinc-300">
                                  <FaClock size={10} />
                                  {objective.startTime || "--:--"}
                                  {objective.estimatedEndTime
                                    ? ` - ${objective.estimatedEndTime}`
                                    : ""}
                                </span>
                              )}

                              {objective.reminderAt && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/12 text-amber-300 border border-amber-500/30">
                                  🔔{" "}
                                  {new Date(
                                    objective.reminderAt,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}

                              {objective.checklistItems.length > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-500/12 text-cyan-300 border border-cyan-500/30">
                                  ✓ {checklistDone}/
                                  {objective.checklistItems.length}
                                </span>
                              )}
                            </div>

                            {objective.checklistItems.length > 0 && (
                              <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/60">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${checklistProgress}%`,
                                    background:
                                      checklistProgress === 100
                                        ? "linear-gradient(90deg, #10b981, #059669)"
                                        : "linear-gradient(90deg, #06b6d4, #3b82f6)",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Detail View */}
                {selectedObjective && (
                  <div>
                    {/* Back Button */}
                    <button
                      onClick={() => setSelectedObjectiveId(null)}
                      className="mb-4 px-4 py-2 rounded-xl bg-zinc-800/70 border border-zinc-700 hover:border-cyan-500/50 hover:bg-zinc-700 transition-all text-sm font-medium text-zinc-300 hover:text-cyan-300"
                    >
                      ← Back to List
                    </button>

                    {/* Detail Card - Same as before */}
                    {(() => {
                      const objective = selectedObjective;

                      const objectiveProgress =
                        objective.checklistItems.length > 0
                          ? Math.round(
                              (objective.checklistItems.filter(
                                (i) => i.completed,
                              ).length /
                                objective.checklistItems.length) *
                                100,
                            )
                          : 0;

                      return (
                        <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl p-5 shadow-xl space-y-4">
                          {/* Objective Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl">
                                  {objective.emoji || "🎯"}
                                </span>
                                <div className="flex-1">
                                  <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2 flex-wrap">
                                    {objective.title}
                                    {objective.repeatEnabled &&
                                      objective.repeatPattern && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs font-semibold border border-cyan-500/30">
                                          Repeats {objective.repeatPattern}
                                        </span>
                                      )}
                                    {objective.isCritical && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/30">
                                        <FaFire size={10} />
                                        CRITICAL
                                      </span>
                                    )}
                                    {objective.status === "completed" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                                        <FaCheckCircle size={10} />
                                        DONE
                                      </span>
                                    )}
                                  </h3>
                                  {objective.description && (
                                    <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                                      {objective.description}
                                    </p>
                                  )}
                                  {(objective.startTime ||
                                    objective.estimatedEndTime ||
                                    objective.reminderAt) && (
                                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                                      {objective.startTime && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                          <FaClock size={9} />
                                          Start: {objective.startTime}
                                        </span>
                                      )}
                                      {objective.estimatedEndTime && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                          <FaClock size={9} />
                                          End: {objective.estimatedEndTime}
                                        </span>
                                      )}
                                      {objective.reminderAt && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-300 rounded-lg border border-amber-500/30">
                                          <FaClock size={9} />
                                          Reminder:{" "}
                                          {new Date(
                                            objective.reminderAt,
                                          ).toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Objective Progress Bar */}
                              {objective.checklistItems.length > 0 && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-zinc-500">
                                      Checklist Progress
                                    </span>
                                    <span className="font-semibold text-cyan-400">
                                      {objectiveProgress}%
                                    </span>
                                  </div>
                                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${objectiveProgress}%`,
                                        background:
                                          objectiveProgress === 100
                                            ? "linear-gradient(90deg, #10b981, #059669)"
                                            : "linear-gradient(90deg, #06b6d4, #3b82f6)",
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setRecurrence(
                                    objective.id,
                                    !objective.repeatEnabled,
                                    objective.repeatPattern || "weekly",
                                  )
                                }
                                className={`text-xs px-3 py-2 rounded-xl border transition-all font-medium ${
                                  objective.repeatEnabled
                                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                                    : "bg-zinc-800/70 border-zinc-700 text-zinc-300 hover:border-cyan-500/40 hover:text-cyan-300"
                                }`}
                                title={
                                  objective.repeatEnabled
                                    ? "Stop repeating"
                                    : "Enable weekly repeat"
                                }
                              >
                                {objective.repeatEnabled
                                  ? "Stop Repeat"
                                  : "Repeat"}
                              </button>
                              <button
                                onClick={() =>
                                  setCritical(
                                    objective.id,
                                    !objective.isCritical,
                                  )
                                }
                                className="text-xs px-3 py-2 rounded-xl bg-zinc-800/70 border border-zinc-700 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 transition-all font-medium"
                              >
                                {objective.isCritical ? (
                                  <FaFlag className="text-rose-400" />
                                ) : (
                                  <FaFlag className="text-zinc-600" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  removeObjectiveWithCleanup(objective.id)
                                }
                                className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all font-medium"
                              >
                                <FaTrash size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Add From Todo Section */}
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                            <select
                              value={selectedTodoId}
                              onChange={(e) => {
                                setSelectedTodoId(e.target.value);
                                setSelectedSubtaskId("");
                              }}
                              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-medium hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                            >
                              <option value="">📋 Select Todo</option>
                              {todoList.map((todo) => (
                                <option key={todo.id} value={todo.id}>
                                  {todo.title} · {todo.column}
                                </option>
                              ))}
                            </select>
                            <select
                              value={selectedSubtaskId}
                              onChange={(e) =>
                                setSelectedSubtaskId(e.target.value)
                              }
                              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-medium hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={
                                !selectedTodo ||
                                (selectedTodo.subtasks || []).length === 0
                              }
                            >
                              <option value="">Full todo</option>
                              {(selectedTodo?.subtasks || []).map((subtask) => (
                                <option key={subtask.id} value={subtask.id}>
                                  {subtask.title}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => addFromTodo(objective.id)}
                              disabled={!selectedTodoId}
                              className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                            >
                              🔗 Link
                            </button>
                          </div>

                          {/* Manual Checklist Add */}
                          <div className="flex items-center gap-2 p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                            <input
                              type="text"
                              value={manualChecklistText}
                              onChange={(e) =>
                                setManualChecklistText(e.target.value)
                              }
                              placeholder="Add a checklist item manually..."
                              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-medium placeholder-zinc-600 hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none transition-colors"
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  manualChecklistText.trim()
                                ) {
                                  addManualChecklist(objective.id);
                                }
                              }}
                            />
                            <button
                              onClick={() => addManualChecklist(objective.id)}
                              disabled={!manualChecklistText.trim()}
                              className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                            >
                              ➕ Add
                            </button>
                          </div>

                          {/* Checklist Items */}
                          <div className="space-y-2">
                            {objective.checklistItems.length === 0 && (
                              <div className="text-center py-6 text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
                                No checklist items yet. Add tasks above to get
                                started.
                              </div>
                            )}
                            {objective.checklistItems.map((item) => (
                              <div
                                key={item.id}
                                className="group flex items-center gap-3 bg-zinc-950/80 border border-zinc-800/70 hover:border-zinc-700 rounded-xl px-3 py-3 transition-all"
                              >
                                <input
                                  type="checkbox"
                                  checked={item.completed}
                                  onChange={() =>
                                    toggleItem(
                                      objective.id,
                                      item.id,
                                      !item.completed,
                                      {
                                        linkedTodoId: item.linkedTodoId,
                                        linkedSubtaskId: item.linkedSubtaskId,
                                      },
                                    )
                                  }
                                  className="w-5 h-5 rounded-lg border-2 border-zinc-700 bg-zinc-900 checked:bg-cyan-500 checked:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-pointer flex-shrink-0"
                                />
                                <input
                                  type="text"
                                  value={item.text}
                                  onChange={(e) =>
                                    updateChecklistItemText(
                                      objective.id,
                                      item.id,
                                      e.target.value,
                                    )
                                  }
                                  className={`flex-1 bg-transparent text-sm outline-none font-medium ${
                                    item.completed
                                      ? "line-through text-zinc-600"
                                      : "text-zinc-200"
                                  }`}
                                />
                                <div className="flex items-center gap-2">
                                  {item.linkedTodoId && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-semibold border border-blue-500/30">
                                      <FaLink size={8} />
                                      LINKED
                                    </span>
                                  )}
                                  {item.orphaned && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-semibold border border-red-500/30">
                                      <FaExclamationTriangle size={8} />
                                      ORPHANED
                                    </span>
                                  )}
                                  <button
                                    onClick={() =>
                                      removeChecklistItem(objective.id, item.id)
                                    }
                                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-500/10"
                                  >
                                    <FaTrash size={11} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Objective History
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Stored history: {historyObjectives.length} objective(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearAllHistory}
                    disabled={historyObjectives.length === 0}
                    className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Delete All History
                  </button>
                  <button
                    onClick={wipeEverything}
                    disabled={allObjectives.length === 0}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Wipe Everything
                  </button>
                </div>
              </div>
            </div>

            {historyObjectives.length === 0 && (
              <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl text-zinc-500">
                No history yet. Objectives from previous days will appear here.
              </div>
            )}

            {Object.entries(historyByDate)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([date, entries]) => (
                <div
                  key={date}
                  className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-200">
                        {date}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {entries.length} objective(s)
                      </div>
                    </div>
                    <button
                      onClick={() => removeHistoryDate(date)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10"
                    >
                      Delete Date
                    </button>
                  </div>

                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 bg-zinc-950/70 border border-zinc-800 rounded-xl px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-200 truncate">
                            {entry.title}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Status: {entry.status} • Checklist:{" "}
                            {
                              entry.checklistItems.filter((i) => i.completed)
                                .length
                            }
                            /{entry.checklistItems.length}
                          </div>
                        </div>
                        <button
                          onClick={() => removeSingleHistoryObjective(entry.id)}
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                          title="Delete objective"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
};
