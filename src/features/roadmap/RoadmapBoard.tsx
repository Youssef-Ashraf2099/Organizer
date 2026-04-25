import { useMemo, useState, useEffect } from "react";
import { RoadmapColumn } from "./RoadmapColumn";
import { useRoadmapStore, RoadmapTask } from "../../core/store/roadmapStore";
import { CalendarEventSlim } from "./CalendarEventCard";

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const loadCalendarEvents = (): CalendarEventSlim[] => {
  try {
    const raw = localStorage.getItem("calendar-events");
    if (!raw) return [];
    return JSON.parse(raw) as CalendarEventSlim[];
  } catch {
    return [];
  }
};

interface RoadmapBoardProps {
  startDate: Date;
  onEditTask: (task: RoadmapTask) => void;
  onAddTask: (dateStr: string) => void;
}

export const RoadmapBoard = ({ startDate, onEditTask, onAddTask }: RoadmapBoardProps) => {
  const tasks = useRoadmapStore((state) => state.tasks);
  const deleteTask = useRoadmapStore((state) => state.deleteTask);

  // ── Calendar events synced from localStorage ────────────────
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventSlim[]>(loadCalendarEvents);

  useEffect(() => {
    // Refresh on storage changes (when user edits Calendar tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "calendar-events") {
        setCalendarEvents(loadCalendarEvents());
      }
    };
    window.addEventListener("storage", onStorage);

    // Also refresh on focus (switching from Calendar to Roadmap tab)
    const onFocus = () => setCalendarEvents(loadCalendarEvents());
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Build the 7 days of the week
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
        const dayCalEvents = calendarEvents.filter((e) => e.date === dateStr);

        return (
          <RoadmapColumn
            key={dateStr}
            date={date}
            tasks={dayTasks}
            calendarEvents={dayCalEvents}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={deleteTask}
          />
        );
      })}
    </div>
  );
};
