import { useState, useEffect } from "react";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";

// Helper function to calculate days left until a date
const calculateDaysLeft = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr + "T00:00");
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Helper function to get days left status text and color
const getDaysLeftDisplay = (
  daysLeft: number
): { text: string; color: string; bgColor: string } => {
  if (daysLeft < 0)
    return { text: "Overdue", color: "text-red-400", bgColor: "bg-red-500/20" };
  if (daysLeft === 0)
    return {
      text: "Today!",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
    };
  if (daysLeft === 1)
    return {
      text: "Tomorrow",
      color: "text-yellow-300",
      bgColor: "bg-yellow-500/20",
    };
  if (daysLeft <= 7)
    return {
      text: `${daysLeft}d left`,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
    };
  if (daysLeft <= 30)
    return {
      text: `${daysLeft}d left`,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    };
  return {
    text: `${daysLeft}d left`,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  };
};

type TodoItem = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  column: "backlog" | "todo" | "inprogress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  tags: string[];
  scheduledFor?: string;
  linkedEventId?: string;
  reminder?: string;
  subtasks?: { id: string; title: string; completed: boolean }[];
  checklist?: { id: string; text: string; completed: boolean }[];
  createdAt: string;
};

const TASK_TAGS = [
  "Work",
  "Personal",
  "Study",
  "Health",
  "Finance",
  "Shopping",
  "Home",
  "Project",
  "Meeting",
  "Urgent",
];

const COLUMNS = [
  { id: "backlog" as const, title: "Backlog", color: "#6366f1" },
  { id: "todo" as const, title: "To Do", color: "#8b5cf6" },
  { id: "inprogress" as const, title: "In Progress", color: "#f59e0b" },
  { id: "done" as const, title: "Done", color: "#10b981" },
];

export const TodoList = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addToColumn, setAddToColumn] = useState<TodoItem["column"]>("backlog");
  const [newTask, setNewTask] = useState<Partial<TodoItem>>({
    title: "",
    description: "",
    priority: "medium",
    tags: [],
    subtasks: [],
    checklist: [],
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load todos from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("personal-todos");
    if (saved) {
      const loadedTodos = JSON.parse(saved);
      console.log("📋 Loaded", loadedTodos.length, "todos from localStorage");
      setTodos(loadedTodos);
    } else {
      console.log("📋 No saved todos found");
    }
    const savedEvents = localStorage.getItem("calendar-events");
    if (savedEvents) {
      setCalendarEvents(JSON.parse(savedEvents));
    }
    setIsInitialized(true);
  }, []);

  // Save todos to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("personal-todos", JSON.stringify(todos));
      console.log("💾 Saved", todos.length, "todos to localStorage");
    }
  }, [todos, isInitialized]);

  const addTodo = (column: TodoItem["column"]) => {
    setAddToColumn(column);
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      tags: [],
      subtasks: [],
      checklist: [],
    });
    setShowAddModal(true);
  };

  const createTodo = () => {
    if (!newTask.title?.trim()) return;

    const todo: TodoItem = {
      id: crypto.randomUUID(),
      title: newTask.title,
      description: newTask.description,
      completed: false,
      column: addToColumn,
      priority: newTask.priority || "medium",
      tags: newTask.tags || [],
      scheduledFor: newTask.scheduledFor,
      linkedEventId: newTask.linkedEventId,
      reminder: newTask.reminder,
      subtasks: newTask.subtasks || [],
      checklist: newTask.checklist || [],
      createdAt: new Date().toLocaleDateString(),
    };

    setTodos([...todos, todo]);
    setShowAddModal(false);
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      tags: [],
      subtasks: [],
      checklist: [],
    });
  };

  const deleteTodo = (id: string) => {
    if (confirm("Delete this task?")) {
      setTodos(todos.filter((t) => t.id !== id));
      if (selectedTodo?.id === id) setSelectedTodo(null);
    }
  };

  const updateTodo = (id: string, updates: Partial<TodoItem>) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    if (selectedTodo?.id === id) {
      setSelectedTodo({ ...selectedTodo, ...updates });
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((column) => {
            const columnTodos = todos.filter((t) => t.column === column.id);
            return (
              <div
                key={column.id}
                className="rounded-lg border-2 flex flex-col"
                style={{ borderColor: column.color }}
              >
                {/* Column Header */}
                <div
                  className="p-3 rounded-t-lg flex items-center justify-between"
                  style={{ backgroundColor: column.color + "20" }}
                >
                  <h3 className="font-bold" style={{ color: column.color }}>
                    {column.title}
                  </h3>
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: column.color }}
                  >
                    {columnTodos.length}
                  </span>
                </div>

                {/* Add Task Button */}
                <button
                  onClick={() => addTodo(column.id)}
                  className="m-3 p-2 text-sm border border-dashed rounded hover:bg-zinc-900 transition"
                  style={{
                    borderColor: column.color + "60",
                    color: column.color,
                  }}
                >
                  + Add Task
                </button>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                  {columnTodos.map((todo) => {
                    const completedSubtasks =
                      todo.subtasks?.filter((s) => s.completed).length || 0;
                    const totalSubtasks = todo.subtasks?.length || 0;
                    const linkedEvent = todo.linkedEventId
                      ? calendarEvents.find((e: any) => e.id === todo.linkedEventId)
                      : null;
                    const daysLeft = linkedEvent
                      ? calculateDaysLeft(linkedEvent.date)
                      : null;

                    return (
                      <div
                        key={todo.id}
                        onClick={() => setSelectedTodo(todo)}
                        className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-sm text-zinc-100 flex-1">
                            {todo.title}
                          </h4>
                          {daysLeft !== null && (
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-md ${
                                getDaysLeftDisplay(daysLeft).color
                              } ${getDaysLeftDisplay(daysLeft).bgColor}`}
                            >
                              {getDaysLeftDisplay(daysLeft).text}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTodo(todo.id);
                            }}
                            className="text-zinc-500 hover:text-red-400 transition"
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>

                        {totalSubtasks > 0 && (
                          <div className="text-xs text-zinc-400 mb-1">
                            {completedSubtasks}/{totalSubtasks} subtasks
                          </div>
                        )}

                        {totalSubtasks > 0 && (
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${
                                  (completedSubtasks / totalSubtasks) * 100
                                }%`,
                                backgroundColor: column.color,
                              }}
                            />
                          </div>
                        )}

                        <div className="text-xs text-zinc-500">
                          Created: {todo.createdAt}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Create New Task</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTask.title || ""}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  autoFocus
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  placeholder="Enter task title..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newTask.description || ""}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  rows={3}
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition resize-none placeholder-zinc-500"
                  placeholder="Add details about this task..."
                />
              </div>

              {/* Row: Status, Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Status
                  </label>
                  <select
                    value={addToColumn}
                    onChange={(e) =>
                      setAddToColumn(e.target.value as TodoItem["column"])
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  >
                    {COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={newTask.priority || "medium"}
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        priority: e.target.value as TodoItem["priority"],
                      })
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">➖ Medium</option>
                    <option value="high">🟡 High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {TASK_TAGS.map((tag) => {
                    const isSelected = (newTask.tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          const tags = newTask.tags || [];
                          if (isSelected) {
                            setNewTask({
                              ...newTask,
                              tags: tags.filter((t) => t !== tag),
                            });
                          } else {
                            setNewTask({
                              ...newTask,
                              tags: [...tags, tag],
                            });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row: Schedule, Reminder */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Schedule for
                  </label>
                  <input
                    type="datetime-local"
                    value={newTask.scheduledFor || ""}
                    onChange={(e) =>
                      setNewTask({ ...newTask, scheduledFor: e.target.value })
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Reminder
                  </label>
                  <input
                    type="datetime-local"
                    value={newTask.reminder || ""}
                    onChange={(e) =>
                      setNewTask({ ...newTask, reminder: e.target.value })
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  />
                </div>
              </div>

              {/* Link to Event */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Link to Calendar Event
                </label>
                <select
                  value={newTask.linkedEventId || ""}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      linkedEventId: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                >
                  <option value="">No linked event</option>
                  {calendarEvents
                    .filter((event: any) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const eventDate = new Date(event.date + "T00:00");
                      return eventDate >= today;
                    })
                    .map((event: any) => (
                      <option key={event.id} value={event.id}>
                        {event.title} - {event.date}
                      </option>
                    ))}
                </select>
                {newTask.linkedEventId && (
                  <div className="mt-2 text-sm font-semibold">
                    {(() => {
                      const linkedEvent = calendarEvents.find(
                        (e: any) => e.id === newTask.linkedEventId
                      );
                      if (!linkedEvent) return null;
                      const daysLeft = calculateDaysLeft(linkedEvent.date);
                      const status = getDaysLeftDisplay(daysLeft);
                      return (
                        <span className={`${status.color} ${status.bgColor} px-3 py-1 rounded-md inline-block`}>
                          {status.text}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Subtasks */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Subtasks
                </label>
                <div className="space-y-2">
                  {(newTask.subtasks || []).map((subtask, idx) => (
                    <div
                      key={subtask.id}
                      className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => {
                          const subtasks = [...(newTask.subtasks || [])];
                          subtasks[idx].completed = !subtasks[idx].completed;
                          setNewTask({ ...newTask, subtasks });
                        }}
                        className="w-4 h-4 rounded border-2 border-zinc-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={subtask.title}
                        onChange={(e) => {
                          const subtasks = [...(newTask.subtasks || [])];
                          subtasks[idx].title = e.target.value;
                          setNewTask({ ...newTask, subtasks });
                        }}
                        className={`flex-1 bg-transparent border-none outline-none text-zinc-100 ${
                          subtask.completed ? "line-through text-zinc-500" : ""
                        }`}
                      />
                      <button
                        onClick={() => {
                          const subtasks = [...(newTask.subtasks || [])];
                          subtasks.splice(idx, 1);
                          setNewTask({ ...newTask, subtasks });
                        }}
                        className="text-zinc-500 hover:text-red-400 transition p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Add Subtask */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSubtaskTitle.trim()) {
                          const subtasks = [
                            ...(newTask.subtasks || []),
                            {
                              id: crypto.randomUUID(),
                              title: newSubtaskTitle,
                              completed: false,
                            },
                          ];
                          setNewTask({ ...newTask, subtasks });
                          setNewSubtaskTitle("");
                        }
                      }}
                      placeholder="Add a subtask..."
                      className="flex-1 bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-indigo-500 outline-none transition placeholder-zinc-500"
                    />
                    <button
                      onClick={() => {
                        if (!newSubtaskTitle.trim()) return;
                        const subtasks = [
                          ...(newTask.subtasks || []),
                          {
                            id: crypto.randomUUID(),
                            title: newSubtaskTitle,
                            completed: false,
                          },
                        ];
                        setNewTask({ ...newTask, subtasks });
                        setNewSubtaskTitle("");
                      }}
                      disabled={!newSubtaskTitle.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Checklist
                </label>
                <div className="space-y-2">
                  {(newTask.checklist || []).map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {
                          const checklist = [...(newTask.checklist || [])];
                          checklist[idx].completed = !checklist[idx].completed;
                          setNewTask({ ...newTask, checklist });
                        }}
                        className="w-4 h-4 rounded border-2 border-zinc-600 text-emerald-600 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => {
                          const checklist = [...(newTask.checklist || [])];
                          checklist[idx].text = e.target.value;
                          setNewTask({ ...newTask, checklist });
                        }}
                        className={`flex-1 bg-transparent border-none outline-none text-zinc-100 ${
                          item.completed ? "line-through text-zinc-500" : ""
                        }`}
                      />
                      <button
                        onClick={() => {
                          const checklist = [...(newTask.checklist || [])];
                          checklist.splice(idx, 1);
                          setNewTask({ ...newTask, checklist });
                        }}
                        className="text-zinc-500 hover:text-red-400 transition p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Add Checklist Item */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newChecklistItem.trim()) {
                          const checklist = [
                            ...(newTask.checklist || []),
                            {
                              id: crypto.randomUUID(),
                              text: newChecklistItem,
                              completed: false,
                            },
                          ];
                          setNewTask({ ...newTask, checklist });
                          setNewChecklistItem("");
                        }
                      }}
                      placeholder="Add a checklist item..."
                      className="flex-1 bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-emerald-500 outline-none transition placeholder-zinc-500"
                    />
                    <button
                      onClick={() => {
                        if (!newChecklistItem.trim()) return;
                        const checklist = [
                          ...(newTask.checklist || []),
                          {
                            id: crypto.randomUUID(),
                            text: newChecklistItem,
                            completed: false,
                          },
                        ];
                        setNewTask({ ...newTask, checklist });
                        setNewChecklistItem("");
                      }}
                      disabled={!newChecklistItem.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={createTodo}
                disabled={!newTask.title?.trim()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {selectedTodo && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTodo(null)}
        >
          <div
            className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Edit Task</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={selectedTodo.title}
                  onChange={(e) =>
                    setSelectedTodo({ ...selectedTodo, title: e.target.value })
                  }
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  placeholder="Enter task title..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Description
                </label>
                <textarea
                  value={selectedTodo.description || ""}
                  onChange={(e) =>
                    setSelectedTodo({
                      ...selectedTodo,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition resize-none placeholder-zinc-500"
                  placeholder="Add details about this task..."
                />
              </div>

              {/* Row: Status, Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Status
                  </label>
                  <select
                    value={selectedTodo.column}
                    onChange={(e) =>
                      setSelectedTodo({
                        ...selectedTodo,
                        column: e.target.value as TodoItem["column"],
                      })
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  >
                    {COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={selectedTodo.priority}
                    onChange={(e) =>
                      setSelectedTodo({
                        ...selectedTodo,
                        priority: e.target.value as TodoItem["priority"],
                      })
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">➖ Medium</option>
                    <option value="high">🟡 High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {TASK_TAGS.map((tag) => {
                    const isSelected = (selectedTodo.tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          const tags = selectedTodo.tags || [];
                          if (isSelected) {
                            setSelectedTodo({
                              ...selectedTodo,
                              tags: tags.filter((t) => t !== tag),
                            });
                          } else {
                            setSelectedTodo({
                              ...selectedTodo,
                              tags: [...tags, tag],
                            });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row: Schedule, Reminder */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Schedule for
                  </label>
                  <input
                    type="datetime-local"
                    value={selectedTodo.scheduledFor || ""}
                    onChange={(e) =>
                      setSelectedTodo({
                        ...selectedTodo,
                        scheduledFor: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Reminder
                  </label>
                  <input
                    type="datetime-local"
                    value={selectedTodo.reminder || ""}
                    onChange={(e) =>
                      setSelectedTodo({
                        ...selectedTodo,
                        reminder: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                  />
                </div>
              </div>

              {/* Link to Event */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Link to Calendar Event
                </label>
                <select
                  value={selectedTodo.linkedEventId || ""}
                  onChange={(e) =>
                    setSelectedTodo({
                      ...selectedTodo,
                      linkedEventId: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                >
                  <option value="">No linked event</option>
                  {calendarEvents
                    .filter((event: any) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const eventDate = new Date(event.date + "T00:00");
                      return eventDate >= today;
                    })
                    .map((event: any) => (
                      <option key={event.id} value={event.id}>
                        {event.title} - {event.date}
                      </option>
                    ))}
                </select>
                {selectedTodo.linkedEventId && (
                  <div className="mt-2 text-sm font-semibold">
                    {(() => {
                      const linkedEvent = calendarEvents.find(
                        (e: any) => e.id === selectedTodo.linkedEventId
                      );
                      if (!linkedEvent) return null;
                      const daysLeft = calculateDaysLeft(linkedEvent.date);
                      const status = getDaysLeftDisplay(daysLeft);
                      return (
                        <span className={`${status.color} ${status.bgColor} px-3 py-1 rounded-md inline-block`}>
                          {status.text}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Subtasks */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Subtasks
                </label>
                <div className="text-xs text-zinc-500 mb-3">
                  {(() => {
                    const completed =
                      selectedTodo.subtasks?.filter((s) => s.completed)
                        .length || 0;
                    const total = selectedTodo.subtasks?.length || 0;
                    const percentage =
                      total > 0 ? Math.round((completed / total) * 100) : 0;
                    return `${percentage}% Complete`;
                  })()}
                </div>
                <div className="space-y-2">
                  {(selectedTodo.subtasks || []).map((subtask, idx) => (
                    <div
                      key={subtask.id}
                      className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => {
                          const newSubtasks = [
                            ...(selectedTodo.subtasks || []),
                          ];
                          newSubtasks[idx].completed =
                            !newSubtasks[idx].completed;
                          setSelectedTodo({
                            ...selectedTodo,
                            subtasks: newSubtasks,
                          });
                        }}
                        className="w-4 h-4 rounded border-2 border-zinc-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={subtask.title}
                        onChange={(e) => {
                          const newSubtasks = [
                            ...(selectedTodo.subtasks || []),
                          ];
                          newSubtasks[idx].title = e.target.value;
                          setSelectedTodo({
                            ...selectedTodo,
                            subtasks: newSubtasks,
                          });
                        }}
                        className={`flex-1 bg-transparent border-none outline-none text-zinc-100 ${
                          subtask.completed ? "line-through text-zinc-500" : ""
                        }`}
                      />
                      <button
                        onClick={() => {
                          const newSubtasks = [
                            ...(selectedTodo.subtasks || []),
                          ];
                          newSubtasks.splice(idx, 1);
                          setSelectedTodo({
                            ...selectedTodo,
                            subtasks: newSubtasks,
                          });
                        }}
                        className="text-zinc-500 hover:text-red-400 transition p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Add Subtask */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSubtaskTitle.trim()) {
                          const newSubtasks = [
                            ...(selectedTodo.subtasks || []),
                            {
                              id: crypto.randomUUID(),
                              title: newSubtaskTitle,
                              completed: false,
                            },
                          ];
                          setSelectedTodo({
                            ...selectedTodo,
                            subtasks: newSubtasks,
                          });
                          setNewSubtaskTitle("");
                        }
                      }}
                      placeholder="Add a subtask..."
                      className="flex-1 bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-indigo-500 outline-none transition placeholder-zinc-500"
                    />
                    <button
                      onClick={() => {
                        if (!newSubtaskTitle.trim()) return;
                        const newSubtasks = [
                          ...(selectedTodo.subtasks || []),
                          {
                            id: crypto.randomUUID(),
                            title: newSubtaskTitle,
                            completed: false,
                          },
                        ];
                        setSelectedTodo({
                          ...selectedTodo,
                          subtasks: newSubtasks,
                        });
                        setNewSubtaskTitle("");
                      }}
                      disabled={!newSubtaskTitle.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Checklist
                </label>
                <div className="space-y-2">
                  {(selectedTodo.checklist || []).map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {
                          const newChecklist = [
                            ...(selectedTodo.checklist || []),
                          ];
                          newChecklist[idx].completed =
                            !newChecklist[idx].completed;
                          setSelectedTodo({
                            ...selectedTodo,
                            checklist: newChecklist,
                          });
                        }}
                        className="w-4 h-4 rounded border-2 border-zinc-600 text-emerald-600 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => {
                          const newChecklist = [
                            ...(selectedTodo.checklist || []),
                          ];
                          newChecklist[idx].text = e.target.value;
                          setSelectedTodo({
                            ...selectedTodo,
                            checklist: newChecklist,
                          });
                        }}
                        className={`flex-1 bg-transparent border-none outline-none text-zinc-100 ${
                          item.completed ? "line-through text-zinc-500" : ""
                        }`}
                      />
                      <button
                        onClick={() => {
                          const newChecklist = [
                            ...(selectedTodo.checklist || []),
                          ];
                          newChecklist.splice(idx, 1);
                          setSelectedTodo({
                            ...selectedTodo,
                            checklist: newChecklist,
                          });
                        }}
                        className="text-zinc-500 hover:text-red-400 transition p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Add Checklist Item */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newChecklistItem.trim()) {
                          const newChecklist = [
                            ...(selectedTodo.checklist || []),
                            {
                              id: crypto.randomUUID(),
                              text: newChecklistItem,
                              completed: false,
                            },
                          ];
                          setSelectedTodo({
                            ...selectedTodo,
                            checklist: newChecklist,
                          });
                          setNewChecklistItem("");
                        }
                      }}
                      placeholder="Add a checklist item..."
                      className="flex-1 bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-emerald-500 outline-none transition placeholder-zinc-500"
                    />
                    <button
                      onClick={() => {
                        if (!newChecklistItem.trim()) return;
                        const newChecklist = [
                          ...(selectedTodo.checklist || []),
                          {
                            id: crypto.randomUUID(),
                            text: newChecklistItem,
                            completed: false,
                          },
                        ];
                        setSelectedTodo({
                          ...selectedTodo,
                          checklist: newChecklist,
                        });
                        setNewChecklistItem("");
                      }}
                      disabled={!newChecklistItem.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-700 flex justify-between gap-3">
              <button
                onClick={() => {
                  if (confirm("Delete this task?")) {
                    deleteTodo(selectedTodo.id);
                  }
                }}
                className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition"
              >
                Delete Task
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTodo(null)}
                  className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    updateTodo(selectedTodo.id, selectedTodo);
                    setSelectedTodo(null);
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition"
                >
                  Update Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
