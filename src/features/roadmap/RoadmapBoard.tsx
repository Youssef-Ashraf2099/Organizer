import { useMemo } from "react";
import { RoadmapColumn } from "./RoadmapColumn";
import { useRoadmapStore, RoadmapTask } from "../../core/store/roadmapStore";

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

interface RoadmapBoardProps {
  startDate: Date;
  onEditTask: (task: RoadmapTask) => void;
  onAddTask: (dateStr: string) => void;
}

export const RoadmapBoard = ({ startDate, onEditTask, onAddTask }: RoadmapBoardProps) => {
  const tasks = useRoadmapStore((state) => state.tasks);
  const deleteTask = useRoadmapStore((state) => state.deleteTask);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [startDate]);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden flex">
      {days.map((date) => {
        const dateStr = toLocalDateKey(date);
        const dayTasks = tasks.filter((t) => t.date === dateStr);
        
        return (
          <RoadmapColumn
            key={dateStr}
            date={date}
            tasks={dayTasks}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={deleteTask}
          />
        );
      })}
    </div>
  );
};
