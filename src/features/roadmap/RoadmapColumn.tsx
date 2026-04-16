import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { RoadmapTask } from "../../core/store/roadmapStore";
import { RoadmapCard } from "./RoadmapCard";

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

interface RoadmapColumnProps {
  date: Date;
  tasks: RoadmapTask[];
  onAddTask: (dateStr: string) => void;
  onEditTask: (task: RoadmapTask) => void;
  onDeleteTask: (id: string) => void;
}

export const RoadmapColumn = ({
  date,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: RoadmapColumnProps) => {
  const isToday = new Date().toDateString() === date.toDateString();
  const dateStr = toLocalDateKey(date);
  
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  const shortDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className={`flex flex-col min-w-[280px] w-[280px] border-r border-zinc-200 dark:border-zinc-800 flex-shrink-0 ${isToday ? "bg-blue-50/30 dark:bg-blue-900/10" : "bg-zinc-50/50 dark:bg-zinc-950/50"}`}>
      {/* Header */}
      <div className={`p-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 ${isToday ? "bg-blue-50 dark:bg-zinc-900" : "bg-white dark:bg-zinc-950"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold ${isToday ? "text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-zinc-100"}`}>
              {dayName}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{shortDate}</p>
          </div>
          <button
            onClick={() => onAddTask(dateStr)}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition"
            title={`Add task for ${dayName}`}
          >
            <FaPlus size={14} />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto min-h-[500px]">
        {tasks.map((task) => (
          <RoadmapCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <div
            onClick={() => onAddTask(dateStr)}
            className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-center text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer transition min-h-[100px]"
          >
            <FaPlus size={16} />
          </div>
        )}
      </div>
    </div>
  );
};
