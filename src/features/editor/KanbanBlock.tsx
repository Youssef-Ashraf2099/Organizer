import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";

type Card = {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  dueDate?: string;
};
type Column = { id: string; title: string; color?: string };

type BoardProps = {
  columns: Column[];
  cards: Record<string, Card[]>; // key: columnId
};

const defaultBoard: BoardProps = {
  columns: [
    { id: "backlog", title: "Backlog", color: "#334155" },
    { id: "inprogress", title: "In Progress", color: "#3b82f6" },
    { id: "review", title: "Review", color: "#f59e0b" },
    { id: "done", title: "Done", color: "#10b981" },
  ],
  cards: {
    backlog: [
      { id: crypto.randomUUID(), title: "Set up project" },
      { id: crypto.randomUUID(), title: "Define requirements" },
    ],
    inprogress: [{ id: crypto.randomUUID(), title: "Implement editor" }],
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
      const [dragCard, setDragCard] = useState<{
        from: string;
        card: Card;
      } | null>(null);

      const updateBoard = (next: BoardProps) => {
        props.editor.updateBlock(props.block, {
          props: { board: next as any },
        });
      };

      const addCard = (columnId: string) => {
        const title = prompt("Card title")?.trim();
        if (!title) return;
        const next = structuredClone(board);
        next.cards[columnId] = next.cards[columnId] || [];
        next.cards[columnId].push({ id: crypto.randomUUID(), title });
        updateBoard(next);
      };

      const addColumn = () => {
        const title = prompt("Column title")?.trim();
        if (!title) return;
        const id = title.toLowerCase().replace(/\s+/g, "-");
        const next = structuredClone(board);
        next.columns.push({ id, title });
        next.cards[id] = [];
        updateBoard(next);
      };

      const onDragStart = (e: React.DragEvent, from: string, card: Card) => {
        e.stopPropagation();
        setDragCard({ from, card });
      };

      const onDragEnd = (e: React.DragEvent) => {
        e.stopPropagation();
      };

      const onDrop = (e: React.DragEvent, to: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragCard) return;
        const next = structuredClone(board);
        next.cards[dragCard.from] = (next.cards[dragCard.from] || []).filter(
          (c) => c.id !== dragCard.card.id
        );
        next.cards[to] = next.cards[to] || [];
        next.cards[to].push(dragCard.card);
        updateBoard(next);
        setDragCard(null);
      };

      const removeCard = (colId: string, cardId: string) => {
        const next = structuredClone(board);
        next.cards[colId] = (next.cards[colId] || []).filter(
          (c) => c.id !== cardId
        );
        updateBoard(next);
      };

      return (
        <div
          className="my-4"
          contentEditable={false}
          data-drag-handle-disabled="true"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Kanban Board</span>
              <input
                type="range"
                min="60"
                max="100"
                value={scale}
                onChange={(e) =>
                  props.editor.updateBlock(props.block, {
                    props: { scale: Number(e.target.value) as any },
                  })
                }
                className="w-24"
                title="Scale"
              />
              <span className="text-xs text-zinc-500">{scale}%</span>
            </div>
            <button
              className="text-xs px-2 py-1 rounded bg-zinc-700 text-white hover:bg-zinc-600"
              onClick={addColumn}
            >
              Add Column
            </button>
          </div>
          <div
            className="flex gap-3 overflow-auto"
            style={{
              transform: `scale(${scale / 100})`,
              transformOrigin: "top left",
            }}
          >
            {board.columns.map((col) => (
              <div
                key={col.id}
                className="min-w-[260px] w-64 bg-zinc-900 rounded-md p-2 border border-zinc-700"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => onDrop(e, col.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: col.color || "#e5e7eb" }}
                  >
                    {col.title}
                  </div>
                  <button
                    onClick={() => addCard(col.id)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 text-white hover:bg-zinc-700"
                  >
                    + Card
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {(board.cards[col.id] || []).map((card) => (
                    <div
                      key={card.id}
                      className="bg-zinc-800 rounded p-2 text-sm border border-zinc-700 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => onDragStart(e, col.id, card)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-zinc-100">
                            {card.title}
                          </div>
                          {card.description && (
                            <div className="text-xs text-zinc-400 mt-1">
                              {card.description}
                            </div>
                          )}
                        </div>
                        <button
                          className="text-xs text-zinc-400 hover:text-red-400"
                          onClick={() => removeCard(col.id, card.id)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    },
  }
);
