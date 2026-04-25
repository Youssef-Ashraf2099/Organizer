import { useState, useEffect } from "react";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaFlag } from "@react-icons/all-files/fa/FaFlag";
import { RoadmapTask, TaskPriority, TaskStatus } from "../../core/store/roadmapStore";
import { cn } from "../../lib/utils";

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<RoadmapTask, "id">) => void;
  initialDate?: string; // YYYY-MM-DD
  initialTask?: RoadmapTask;
}

const COLORS = ["blue", "purple", "green", "orange", "pink"];
const SUGGESTED_TAGS = ["operation", "intel", "logistics", "maintenance", "comms", "urgent"];

export const TaskDialog = ({
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialTask,
}: TaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [color, setColor] = useState("blue");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [status, setStatus] = useState<TaskStatus>("pending");

  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description);
        setTime(initialTask.time);
        setDate(initialTask.date);
        setColor(initialTask.color);
        setTags(initialTask.tags);
        setPriority(initialTask.priority || "normal");
        setStatus(initialTask.status || "pending");
      } else {
        setTitle("");
        setDescription("");
        setTime("");
        setDate(initialDate || new Date().toISOString().split("T")[0]);
        setColor("blue");
        setTags([]);
        setPriority("normal");
        setStatus("pending");
      }
      setTagInput("");
    }
  }, [isOpen, initialTask, initialDate]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim() || !date) return;
    
    // Auto-add pending tag if any
    const finalTags = [...tags];
    if (tagInput.trim()) {
      finalTags.push(tagInput.trim());
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      time: time.trim(),
      date,
      color,
      tags: finalTags,
      priority,
      status,
    });
    onClose();
  };

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-zinc-700">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            {initialTask ? "Update Mission Specs" : "Draft New Mission"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Mission Objective *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Secure the perimeter"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Target Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Time Window
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 0900 - 1100"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Priority Level
              </label>
              <div className="flex items-center gap-2">
                {(["critical", "high", "normal", "low"] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-lg border transition",
                      priority === p ? "border-zinc-500 bg-zinc-800" : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                    )}
                    title={p}
                  >
                    <FaFlag
                      className={cn(
                        p === "critical" && "text-red-500",
                        p === "high" && "text-amber-500",
                        p === "normal" && "text-blue-400",
                        p === "low" && "text-zinc-500"
                      )}
                      size={14}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Current Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Intel Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-300 border border-zinc-700"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-400"
                  >
                    <FaTimes size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    addTag(tagInput.trim());
                  }
                }}
                placeholder="Add intel tag..."
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  if (tagInput.trim()) addTag(tagInput.trim());
                }}
                className="px-4 py-2 bg-zinc-800 rounded-lg text-sm font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full border border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Squad Color
            </label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    color === c ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100",
                    c === "blue" && "bg-blue-500",
                    c === "purple" && "bg-purple-500",
                    c === "green" && "bg-emerald-500",
                    c === "orange" && "bg-amber-500",
                    c === "pink" && "bg-pink-500"
                  )}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Mission Briefing
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed intel..."
              rows={4}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
          >
            Abort
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !date}
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deploy Mission
          </button>
        </div>
      </div>
    </div>
  );
};
