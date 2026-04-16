import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaEdit } from "@react-icons/all-files/fa/FaEdit";
import { FaClock } from "@react-icons/all-files/fa/FaClock";
import { RoadmapTask } from "../../core/store/roadmapStore";
import { cn } from "../../lib/utils";

interface RoadmapCardProps {
  task: RoadmapTask;
  onEdit: () => void;
  onDelete: () => void;
}

export const RoadmapCard = ({ task, onEdit, onDelete }: RoadmapCardProps) => {
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

  const themeClass = colorMap[task.color] || colorMap.blue;
  const tagThemeClass = tagColorMap[task.color] || tagColorMap.blue;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 relative group transition-all hover:shadow-md cursor-grab active:cursor-grabbing",
        themeClass
      )}
    >
      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition"
          title="Edit Task"
        >
          <FaEdit size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition text-red-500 hover:text-red-700"
          title="Delete Task"
        >
          <FaTrash size={12} />
        </button>
      </div>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pr-10">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide",
                tagThemeClass
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="font-semibold text-sm leading-tight mt-1 pr-10">
        {task.title}
      </h4>

      {/* Time */}
      {task.time && (
        <div className="flex items-center gap-1.5 text-xs opacity-80 mt-1">
          <FaClock size={10} />
          <span>{task.time}</span>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p className="text-xs opacity-70 line-clamp-3 mt-1.5 leading-relaxed">
          {task.description}
        </p>
      )}
    </div>
  );
};
