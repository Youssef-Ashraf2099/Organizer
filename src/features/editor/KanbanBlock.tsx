import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaUser } from "@react-icons/all-files/fa/FaUser";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";

type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

type ChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
};

type Card = {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  assignees?: string[];
  priority?: "low" | "medium" | "high";
  subtasks?: Subtask[];
  checklist?: ChecklistItem[];
};

type Column = { id: string; title: string; color?: string };

type BoardProps = {
  columns: Column[];
  cards: Record<string, Card[]>;
};

const PREDEFINED_TAGS = [
  { name: "bug", color: "#ef4444", label: "🐛 Bug" },
  { name: "feature", color: "#3b82f6", label: "✨ Feature" },
  { name: "enhancement", color: "#10b981", label: "⚡ Enhancement" },
  { name: "documentation", color: "#8b5cf6", label: "📚 Documentation" },
  { name: "testing", color: "#f59e0b", label: "🧪 Testing" },
  { name: "urgent", color: "#dc2626", label: "🔥 Urgent" },
  { name: "design", color: "#ec4899", label: "🎨 Design" },
  { name: "backend", color: "#06b6d4", label: "⚙️ Backend" },
  { name: "frontend", color: "#a855f7", label: "🖥️ Frontend" },
  { name: "blocked", color: "#64748b", label: "🚫 Blocked" },
];

const TAG_COLOR_MAP: Record<string, string> = {
  bug: "#ef4444",
  feature: "#3b82f6",
  enhancement: "#10b981",
  documentation: "#8b5cf6",
  testing: "#f59e0b",
  urgent: "#dc2626",
  design: "#ec4899",
  backend: "#06b6d4",
  frontend: "#a855f7",
  blocked: "#64748b",
};

const PRIORITY_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

const defaultBoard: BoardProps = {
  columns: [
    { id: "backlog", title: "Backlog", color: "#64748b" },
    { id: "todo", title: "To Do", color: "#6366f1" },
    { id: "inprogress", title: "In Progress", color: "#f59e0b" },
    { id: "review", title: "Review", color: "#ec4899" },
    { id: "done", title: "Done", color: "#10b981" },
  ],
  cards: {
    backlog: [{ id: crypto.randomUUID(), title: "Set up project" }],
    todo: [{ id: crypto.randomUUID(), title: "Define requirements" }],
    inprogress: [{ id: crypto.randomUUID(), title: "Implement features" }],
    review: [],
    done: [],
  },
};

export const KanbanBlock = createReactBlockSpec(
  {
    type: "kanban",
    propSchema: {
      board: { default: defaultBoard as any },
      scale: { default: 100 },
    },
    content: "none",
  },
  {
    render: (props) => {
      const board =
        (props.block.props.board as unknown as BoardProps) ?? defaultBoard;
      const scale = Number(props.block.props.scale ?? 100);
      const [editingCard, setEditingCard] = useState<{
        columnId: string;
        card: Card;
      } | null>(null);
      const [newAssigneeName, setNewAssigneeName] = useState("");

      const updateBoard = (next: BoardProps) => {
        props.editor.updateBlock(props.block, {
          props: { board: next as any },
        });
      };

      const addCard = (columnId: string) => {
        const title = prompt("Card title:")?.trim();
        if (!title) return;
        const next = structuredClone(board);
        next.cards[columnId] = next.cards[columnId] || [];
        next.cards[columnId].push({
          id: crypto.randomUUID(),
          title,
          tags: [],
          priority: "medium",
          subtasks: [],
          checklist: [],
        });
        updateBoard(next);
      };

      const addColumn = () => {
        const title = prompt("Column title:")?.trim();
        if (!title) return;
        const id = title.toLowerCase().replace(/\s+/g, "-");
        if (board.columns.find((c) => c.id === id)) {
          alert("Column already exists!");
          return;
        }
        const next = structuredClone(board);
        next.columns.push({
          id,
          title,
          color: "#6366f1",
        });
        next.cards[id] = [];
        updateBoard(next);
      };

      const deleteColumn = (colId: string) => {
        if (
          !confirm(
            `Delete column "${
              board.columns.find((c) => c.id === colId)?.title
            }"?`
          )
        )
          return;
        const next = structuredClone(board);
        next.columns = next.columns.filter((c) => c.id !== colId);
        delete next.cards[colId];
        updateBoard(next);
      };

      const updateCard = (
        colId: string,
        cardId: string,
        updates: Partial<Card>
      ) => {
        const next = structuredClone(board);
        const card = next.cards[colId]?.find((c) => c.id === cardId);
        if (card) {
          Object.assign(card, updates);
          updateBoard(next);
        }
      };

      const removeCard = (colId: string, cardId: string) => {
        const next = structuredClone(board);
        next.cards[colId] = (next.cards[colId] || []).filter(
          (c) => c.id !== cardId
        );
        updateBoard(next);
      };

      const toggleTag = (colId: string, cardId: string, tagName: string) => {
        const next = structuredClone(board);
        const card = next.cards[colId]?.find((c) => c.id === cardId);
        if (!card) return;

        card.tags = card.tags || [];
        const idx = card.tags.indexOf(tagName);
        if (idx >= 0) {
          card.tags.splice(idx, 1);
        } else {
          card.tags.push(tagName);
        }
        updateBoard(next);
      };

      const moveCard = (fromColId: string, toColId: string, cardId: string) => {
        const next = structuredClone(board);
        const cardIdx = next.cards[fromColId]?.findIndex(
          (c) => c.id === cardId
        );
        if (cardIdx === undefined || cardIdx < 0) return;

        const [card] = next.cards[fromColId].splice(cardIdx, 1);
        next.cards[toColId] = next.cards[toColId] || [];
        next.cards[toColId].push(card);
        updateBoard(next);
      };

      const updateCardInModal = (updates: Partial<Card>) => {
        if (!editingCard) return;
        const next = structuredClone(board);
        const card = next.cards[editingCard.columnId]?.find(
          (c) => c.id === editingCard.card.id
        );
        if (card) {
          Object.assign(card, updates);
          setEditingCard({ ...editingCard, card: { ...card, ...updates } });
          updateBoard(next);
        }
      };

      const saveCardAndClose = () => {
        setEditingCard(null);
      };

      return (
        <div
          className="my-4"
          contentEditable={false}
          data-drag-handle-disabled="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-400">
                KANBAN BOARD
              </span>
              <input
                type="range"
                min="60"
                max="120"
                value={scale}
                onChange={(e) =>
                  props.editor.updateBlock(props.block, {
                    props: { scale: Number(e.target.value) as any },
                  })
                }
                className="w-20"
                title="Zoom"
              />
              <span className="text-xs text-zinc-500">{scale}%</span>
            </div>
            <button
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              onClick={addColumn}
            >
              <FaPlus size={12} /> Column
            </button>
          </div>

          {/* Board */}
          <div
            className="flex gap-4 overflow-auto pb-4 px-2"
            style={{
              transform: `scale(${scale / 100})`,
              transformOrigin: "top left",
              height: "fit-content",
            }}
          >
            {board.columns.map((col) => (
              <div
                key={col.id}
                className="flex-shrink-0 w-80 bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden flex flex-col"
              >
                {/* Column Header */}
                <div
                  className="p-3 border-b border-zinc-700 flex items-center justify-between"
                  style={{ backgroundColor: (col.color || "#3f3f46") + "20" }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: col.color || "#9ca3af" }}
                    />
                    <span
                      className="font-semibold text-sm"
                      style={{ color: col.color || "#e5e7eb" }}
                    >
                      {col.title}
                    </span>
                    <span className="text-xs text-zinc-500 ml-auto">
                      {(board.cards[col.id] || []).length}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteColumn(col.id)}
                    className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                    title="Delete column"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {(board.cards[col.id] || []).map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setEditingCard({ columnId: col.id, card })}
                      className="bg-zinc-800 rounded-lg p-3 border-2 border-zinc-700 cursor-pointer transition-all hover:border-blue-500 hover:shadow-lg"
                    >
                      {/* Priority Badge */}
                      {card.priority && (
                        <div className="flex items-center gap-1 mb-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              backgroundColor:
                                PRIORITY_COLORS[card.priority] + "30",
                              color: PRIORITY_COLORS[card.priority],
                            }}
                          >
                            {card.priority.toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Title */}
                      <div className="font-medium text-sm text-zinc-100 mb-2">
                        {card.title}
                      </div>

                      {/* Description preview */}
                      {card.description && (
                        <div className="text-xs text-zinc-400 mb-2 line-clamp-2">
                          {card.description}
                        </div>
                      )}

                      {/* Subtasks progress */}
                      {card.subtasks && card.subtasks.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-xs text-zinc-400">
                            {card.subtasks.filter((s) => s.completed).length}/
                            {card.subtasks.length} subtasks
                          </div>
                        </div>
                      )}

                      {/* Checklist progress */}
                      {card.checklist && card.checklist.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-xs text-zinc-400">
                            {card.checklist.filter((c) => c.checked).length}/
                            {card.checklist.length} checklist
                          </div>
                        </div>
                      )}

                      {/* Tags - Predefined with Colors */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {card.tags?.map((tagName) => {
                          const tagDef = PREDEFINED_TAGS.find(
                            (t) => t.name === tagName
                          );
                          if (!tagDef) return null;
                          return (
                            <div
                              key={tagName}
                              className="text-xs px-2 py-1 rounded font-semibold text-white"
                              style={{
                                backgroundColor: TAG_COLOR_MAP[tagName],
                                borderLeft: `4px solid ${TAG_COLOR_MAP[tagName]}`,
                              }}
                            >
                              {tagDef.label}
                            </div>
                          );
                        })}
                      </div>

                      {/* Assignees Section */}
                      {card.assignees && card.assignees.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {card.assignees.map((assignee, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                              style={{
                                backgroundColor: "#7c3aed30",
                                color: "#c084fc",
                              }}
                            >
                              <FaUser size={10} />
                              <span className="font-semibold">{assignee}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delete Card */}
                      <div className="flex justify-end pt-2 border-t border-zinc-700">
                        <button
                          className="text-xs text-zinc-500 hover:text-red-400 transition-colors p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCard(col.id, card.id);
                          }}
                          title="Delete card"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add Card Button */}
                  <button
                    onClick={() => addCard(col.id)}
                    className="w-full text-xs px-2 py-2 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors border border-dashed border-zinc-600"
                  >
                    + Add Card
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Card Edit Modal */}
          {editingCard && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => setEditingCard(null)}
            >
              <div
                className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Edit Task
                  </h3>
                  <button
                    onClick={() => setEditingCard(null)}
                    className="text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editingCard.card.title}
                      onChange={(e) =>
                        updateCardInModal({ title: e.target.value })
                      }
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editingCard.card.description || ""}
                      onChange={(e) =>
                        updateCardInModal({ description: e.target.value })
                      }
                      rows={4}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                      placeholder="Add a description..."
                    />
                  </div>

                  {/* Column Selector */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Column
                    </label>
                    <select
                      value={editingCard.columnId}
                      onChange={(e) => {
                        moveCard(
                          editingCard.columnId,
                          e.target.value,
                          editingCard.card.id
                        );
                        setEditingCard({
                          ...editingCard,
                          columnId: e.target.value,
                        });
                      }}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                    >
                      {board.columns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={editingCard.card.priority || "medium"}
                      onChange={(e) =>
                        updateCardInModal({
                          priority: e.target.value as "low" | "medium" | "high",
                        })
                      }
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_TAGS.map((tagDef) => (
                        <button
                          key={tagDef.name}
                          onClick={() =>
                            toggleTag(
                              editingCard.columnId,
                              editingCard.card.id,
                              tagDef.name
                            )
                          }
                          className={`text-xs px-3 py-1.5 rounded font-semibold transition-all ${
                            editingCard.card.tags?.includes(tagDef.name)
                              ? "text-white shadow-md"
                              : "text-zinc-400 opacity-50 hover:opacity-100"
                          }`}
                          style={{
                            backgroundColor: TAG_COLOR_MAP[tagDef.name],
                            opacity: editingCard.card.tags?.includes(
                              tagDef.name
                            )
                              ? 1
                              : 0.4,
                            borderLeft: editingCard.card.tags?.includes(
                              tagDef.name
                            )
                              ? `4px solid ${TAG_COLOR_MAP[tagDef.name]}`
                              : "none",
                          }}
                        >
                          {tagDef.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assignees */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Assignees
                    </label>
                    <div className="space-y-2">
                      {(editingCard.card.assignees || []).map(
                        (assignee, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={assignee}
                              onChange={(e) => {
                                const newAssignees = [
                                  ...(editingCard.card.assignees || []),
                                ];
                                newAssignees[idx] = e.target.value;
                                updateCardInModal({ assignees: newAssignees });
                              }}
                              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={() => {
                                const newAssignees = [
                                  ...(editingCard.card.assignees || []),
                                ];
                                newAssignees.splice(idx, 1);
                                updateCardInModal({ assignees: newAssignees });
                              }}
                              className="text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <FaTrash size={12} />
                            </button>
                          </div>
                        )
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newAssigneeName}
                          onChange={(e) => setNewAssigneeName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newAssigneeName.trim()) {
                              const newAssignees = [
                                ...(editingCard.card.assignees || []),
                                newAssigneeName.trim(),
                              ];
                              updateCardInModal({ assignees: newAssignees });
                              setNewAssigneeName("");
                            }
                          }}
                          placeholder="Add assignee..."
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 text-sm focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => {
                            if (!newAssigneeName.trim()) return;
                            const newAssignees = [
                              ...(editingCard.card.assignees || []),
                              newAssigneeName.trim(),
                            ];
                            updateCardInModal({ assignees: newAssignees });
                            setNewAssigneeName("");
                          }}
                          disabled={!newAssigneeName.trim()}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <FaPlus size={12} />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Subtasks */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Subtasks
                    </label>
                    <div className="space-y-2">
                      {(editingCard.card.subtasks || []).map((subtask, idx) => (
                        <div
                          key={subtask.id}
                          className="flex items-center gap-2"
                        >
                          <button
                            onClick={() => {
                              const newSubtasks = [
                                ...(editingCard.card.subtasks || []),
                              ];
                              newSubtasks[idx].completed =
                                !newSubtasks[idx].completed;
                              updateCardInModal({ subtasks: newSubtasks });
                            }}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              subtask.completed
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-zinc-600 hover:border-emerald-500"
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
                                ...(editingCard.card.subtasks || []),
                              ];
                              newSubtasks[idx].title = e.target.value;
                              updateCardInModal({ subtasks: newSubtasks });
                            }}
                            className={`flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-blue-500 ${
                              subtask.completed
                                ? "line-through text-zinc-500"
                                : ""
                            }`}
                          />
                          <button
                            onClick={() => {
                              const newSubtasks = [
                                ...(editingCard.card.subtasks || []),
                              ];
                              newSubtasks.splice(idx, 1);
                              updateCardInModal({ subtasks: newSubtasks });
                            }}
                            className="text-zinc-500 hover:text-red-400 transition-colors"
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
                            ...(editingCard.card.subtasks || []),
                            {
                              id: crypto.randomUUID(),
                              title,
                              completed: false,
                            },
                          ];
                          updateCardInModal({ subtasks: newSubtasks });
                        }}
                        className="w-full text-xs px-3 py-2 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors border border-dashed border-zinc-600"
                      >
                        + Add Subtask
                      </button>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Checklist
                    </label>
                    <div className="space-y-2">
                      {(editingCard.card.checklist || []).map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const newChecklist = [
                                ...(editingCard.card.checklist || []),
                              ];
                              newChecklist[idx].checked =
                                !newChecklist[idx].checked;
                              updateCardInModal({ checklist: newChecklist });
                            }}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              item.checked
                                ? "bg-blue-500 border-blue-500"
                                : "border-zinc-600 hover:border-blue-500"
                            }`}
                          >
                            {item.checked && (
                              <FaCheck size={12} className="text-white" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => {
                              const newChecklist = [
                                ...(editingCard.card.checklist || []),
                              ];
                              newChecklist[idx].text = e.target.value;
                              updateCardInModal({ checklist: newChecklist });
                            }}
                            className={`flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-blue-500 ${
                              item.checked ? "line-through text-zinc-500" : ""
                            }`}
                          />
                          <button
                            onClick={() => {
                              const newChecklist = [
                                ...(editingCard.card.checklist || []),
                              ];
                              newChecklist.splice(idx, 1);
                              updateCardInModal({ checklist: newChecklist });
                            }}
                            className="text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const text = prompt("Checklist item:")?.trim();
                          if (!text) return;
                          const newChecklist = [
                            ...(editingCard.card.checklist || []),
                            {
                              id: crypto.randomUUID(),
                              text,
                              checked: false,
                            },
                          ];
                          updateCardInModal({ checklist: newChecklist });
                        }}
                        className="w-full text-xs px-3 py-2 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors border border-dashed border-zinc-600"
                      >
                        + Add Checklist Item
                      </button>
                    </div>
                  </div>

                  {/* Delete Card */}
                  <div className="pt-4 border-t border-zinc-700">
                    <button
                      onClick={() => {
                        if (
                          confirm("Are you sure you want to delete this card?")
                        ) {
                          removeCard(editingCard.columnId, editingCard.card.id);
                          setEditingCard(null);
                        }
                      }}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <FaTrash size={14} />
                      Delete Card
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-700">
                  <button
                    onClick={() => setEditingCard(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
  }
);
