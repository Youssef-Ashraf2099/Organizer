import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaEdit } from "@react-icons/all-files/fa/FaEdit";
import { FaClock } from "@react-icons/all-files/fa/FaClock";
import { FaCheckCircle } from "@react-icons/all-files/fa/FaCheckCircle";
import { FaRegCircle } from "@react-icons/all-files/fa/FaRegCircle";
import { FaPlayCircle } from "@react-icons/all-files/fa/FaPlayCircle";
import { RoadmapTask, useRoadmapStore } from "../../core/store/roadmapStore";
import { cn } from "../../lib/utils";

interface RoadmapCardProps {
  task: RoadmapTask;
  onEdit: () => void;
  onDelete: () => void;
}

export const RoadmapCard = ({ task, onEdit, onDelete }: RoadmapCardProps) => {
  const toggleStatus = useRoadmapStore((s) => s.toggleStatus);

  // Map base color to exact tailwind classes for light/dark modes
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100 block-highlight-blue",
    purple: "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-100",
    green: "bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
    orange: "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-100",
    pink: "bg-pink-50 border-pink-200 text-pink-900 dark:bg-pink-900/20 dark:border-pink-800 dark:text-pink-100",
  };

  const tagColorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
    green: "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
    pink: "bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300",
  };

  const priorityColorMap: Record<string, string> = {
    critical: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
    high: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
    normal: "bg-blue-400",
    low: "bg-zinc-400",
  };

  const themeClass = colorMap[task.color] || colorMap.blue;
  const tagThemeClass = tagColorMap[task.color] || tagColorMap.blue;
  const priorityColor = priorityColorMap[task.priority || "normal"];
  const isDone = task.status === "done";

  const renderStatusIcon = () => {
    switch (task.status) {
      case "done":
        return <FaCheckCircle className="text-emerald-500" size={14} />;
      case "in-progress":
        return <FaPlayCircle className="text-amber-500 animate-pulse" size={14} />;
      default:
        return <FaRegCircle className="text-zinc-400 dark:text-zinc-500" size={14} />;
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 relative group transition-all cursor-grab active:cursor-grabbing",
        themeClass,
        isDone ? "opacity-50 grayscale-[0.5]" : "hover:shadow-md"
      )}
    >
      {/* Priority indicator */}
      <div
        className={cn("absolute -top-1 -left-1 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 z-10", priorityColor)}
        title={`Priority: ${task.priority || "normal"}`}
      />

      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition"
          title="Edit Mission"
        >
          <FaEdit size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition text-red-500 hover:text-red-700"
          title="Delete Mission"
        >
          <FaTrash size={12} />
        </button>
      </div>

      <div className="flex items-start gap-2 pr-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleStatus(task.id);
          }}
          className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
          title={`Status: ${task.status || "pending"} (Click to cycle)`}
        >
          {renderStatusIcon()}
        </button>
        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              "font-semibold text-sm leading-tight transition-all",
              isDone ? "line-through opacity-70" : ""
            )}
          >
            {task.title}
          </h4>
        </div>
      </div>

      {/* Time */}
      {task.time && (
        <div className="flex items-center gap-1.5 text-xs opacity-80 mt-0.5 ml-6">
          <FaClock size={10} />
          <span>{task.time}</span>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p className="text-xs opacity-70 line-clamp-3 mt-1 leading-relaxed ml-6">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 ml-6">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase",
                tagThemeClass
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
