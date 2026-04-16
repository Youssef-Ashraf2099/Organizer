import { useState, useEffect } from "react";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { RoadmapTask } from "../../core/store/roadmapStore";
import { cn } from "../../lib/utils";

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<RoadmapTask, "id">) => void;
  initialDate?: string; // YYYY-MM-DD
  initialTask?: RoadmapTask;
}

const COLORS = ["blue", "purple", "green", "orange", "pink"];
const SUGGESTED_TAGS = ["lecture", "work", "study", "project", "meeting", "exam"];

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

  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description);
        setTime(initialTask.time);
        setDate(initialTask.date);
        setColor(initialTask.color);
        setTags(initialTask.tags);
      } else {
        setTitle("");
        setDescription("");
        setTime("");
        setDate(initialDate || new Date().toISOString().split("T")[0]);
        setColor("blue");
        setTags([]);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {initialTask ? "Edit Task" : "Add Weekly Task"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lecture: React Hooks"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Time/Duration
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 9:00 AM - 11:00 AM"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-200 dark:bg-zinc-800 text-xs font-medium"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500"
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
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
              />
              <button
                onClick={() => {
                  if (tagInput.trim()) addTag(tagInput.trim());
                }}
                className="px-3 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SUGGESTED_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="px-2 py-1 text-[10px] rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Color Theme
            </label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    color === c ? "border-zinc-900 dark:border-zinc-100 scale-110" : "border-transparent opacity-70 hover:opacity-100",
                    c === "blue" && "bg-blue-400",
                    c === "purple" && "bg-purple-400",
                    c === "green" && "bg-green-400",
                    c === "orange" && "bg-orange-400",
                    c === "pink" && "bg-pink-400"
                  )}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task details..."
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !date}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
};
