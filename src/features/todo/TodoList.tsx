import { useState, useEffect } from "react";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaEdit } from "@react-icons/all-files/fa/FaEdit";

type TodoItem = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  column: "backlog" | "todo" | "inprogress" | "done";
  subtasks?: { id: string; title: string; completed: boolean }[];
  createdAt: string;
};

const COLUMNS = [
  { id: "backlog" as const, title: "Backlog", color: "#6366f1" },
  { id: "todo" as const, title: "To Do", color: "#8b5cf6" },
  { id: "inprogress" as const, title: "In Progress", color: "#f59e0b" },
  { id: "done" as const, title: "Done", color: "#10b981" },
];

export const TodoList = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("personal-todos");
    if (saved) {
      setTodos(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("personal-todos", JSON.stringify(todos));
  }, [todos]);

  const addTodo = (column: TodoItem["column"]) => {
    const title = prompt("Task title:")?.trim();
    if (!title) return;

    const newTodo: TodoItem = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      column,
      subtasks: [],
      createdAt: new Date().toLocaleDateString(),
    };

    setTodos([...todos, newTodo]);
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

  const moveTodo = (id: string, newColumn: TodoItem["column"]) => {
    updateTodo(id, { column: newColumn });
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

      {/* Edit Modal */}
      {selectedTodo && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedTodo(null)}
        >
          <div
            className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700">
              <h3 className="text-lg font-semibold text-zinc-100">Edit Task</h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={selectedTodo.title}
                  onChange={(e) =>
                    setSelectedTodo({ ...selectedTodo, title: e.target.value })
                  }
                  onBlur={() =>
                    updateTodo(selectedTodo.id, { title: selectedTodo.title })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
                />
              </div>

              {/* Column */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Column
                </label>
                <select
                  value={selectedTodo.column}
                  onChange={(e) => {
                    const newColumn = e.target.value as TodoItem["column"];
                    moveTodo(selectedTodo.id, newColumn);
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subtasks */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Subtasks
                </label>
                <div className="space-y-2">
                  {(selectedTodo.subtasks || []).map((subtask, idx) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newSubtasks = [
                            ...(selectedTodo.subtasks || []),
                          ];
                          newSubtasks[idx].completed =
                            !newSubtasks[idx].completed;
                          updateTodo(selectedTodo.id, {
                            subtasks: newSubtasks,
                          });
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          subtask.completed
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-zinc-600"
                        }`}
                      >
                        {subtask.completed && (
                          <FaCheck size={12} className="text-white" />
                        )}
                      </button>
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
                        onBlur={() =>
                          updateTodo(selectedTodo.id, {
                            subtasks: selectedTodo.subtasks,
                          })
                        }
                        className={`flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 ${
                          subtask.completed ? "line-through text-zinc-500" : ""
                        }`}
                      />
                      <button
                        onClick={() => {
                          const newSubtasks = [
                            ...(selectedTodo.subtasks || []),
                          ];
                          newSubtasks.splice(idx, 1);
                          updateTodo(selectedTodo.id, {
                            subtasks: newSubtasks,
                          });
                        }}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const title = prompt("Subtask title:")?.trim();
                      if (!title) return;
                      const newSubtasks = [
                        ...(selectedTodo.subtasks || []),
                        { id: crypto.randomUUID(), title, completed: false },
                      ];
                      updateTodo(selectedTodo.id, { subtasks: newSubtasks });
                    }}
                    className="w-full px-3 py-2 text-sm border border-dashed border-zinc-700 rounded hover:bg-zinc-800 text-zinc-400"
                  >
                    + Add Subtask
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-700 flex justify-end">
              <button
                onClick={() => setSelectedTodo(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
