import { useState, useMemo } from "react";
import { FaChevronLeft } from "@react-icons/all-files/fa/FaChevronLeft";
import { FaChevronRight } from "@react-icons/all-files/fa/FaChevronRight";
import { FaBell } from "@react-icons/all-files/fa/FaBell";
import { FaBellSlash } from "@react-icons/all-files/fa/FaBellSlash";
import { RoadmapBoard } from "./RoadmapBoard";
import { TaskDialog } from "./TaskDialog";
import { useRoadmapStore, RoadmapTask } from "../../core/store/roadmapStore";
import { notificationService } from "../../core/services/notificationService";

export const WeeklyRoadmap = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const addTask = useRoadmapStore((state) => state.addTask);
  const updateTask = useRoadmapStore((state) => state.updateTask);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RoadmapTask | undefined>();
  const [targetDate, setTargetDate] = useState<string | undefined>();
  
  const [reminderEnabled, setReminderEnabled] = useState(() => {
    return localStorage.getItem("omni-roadmap-reminder") === "true";
  });

  const getSaturday = (d: Date) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = date.getDate() - ((day + 1) % 7);
    const res = new Date(date.setDate(diff));
    return res;
  };

  const currentSaturday = useMemo(() => getSaturday(currentDate), [currentDate]);
  
  const currentSunday = useMemo(() => {
    const d = new Date(currentSaturday);
    d.setDate(d.getDate() + 6);
    return d;
  }, [currentSaturday]);

  const weekLabel = `${currentSaturday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${currentSunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openAddDialog = (dateStr: string) => {
    setEditingTask(undefined);
    setTargetDate(dateStr);
    setDialogOpen(true);
  };

  const openEditDialog = (task: RoadmapTask) => {
    setEditingTask(task);
    setTargetDate(undefined);
    setDialogOpen(true);
  };

  const handleSaveTask = (taskData: Omit<RoadmapTask, "id">) => {
    if (editingTask) {
      updateTask(editingTask.id, taskData);
    } else {
      addTask(taskData);
    }
  };

  const toggleReminder = async () => {
    const newState = !reminderEnabled;
    
    // Test if notifications are permitted before enabling
    if (newState) {
      const permItem = await notificationService.requestPermission();
      if (!permItem) {
         // Could show toast that permission was denied here
         return;
      }
    }

    setReminderEnabled(newState);
    localStorage.setItem("omni-roadmap-reminder", newState.toString());

    if (newState) {
      // Schedule next Sunday at 5 PM
      const nextSunday = new Date();
      nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
      nextSunday.setHours(17, 0, 0, 0);
      
      // If we are past Sunday 5 PM this week, schedule for next week
      if (nextSunday.getTime() <= Date.now()) {
        nextSunday.setDate(nextSunday.getDate() + 7);
      }

      notificationService.scheduleReminder({
        type: "task_reminder",
        title: "Plan Your Week!",
        body: "Time to update your Weekly Roadmap and organize your upcoming tasks.",
        scheduledAt: nextSunday.toISOString(),
        linkedId: "weekly-roadmap-reminder",
      });
    } else {
      notificationService.removeRemindersForItem("weekly-roadmap-reminder");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Weekly Roadmap
          </h2>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800/50 px-3 py-1 rounded-full">
            {weekLabel}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleReminder}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${reminderEnabled ? "text-amber-600 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400" : "text-zinc-500 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400"}`}
            title="Toggle weekly planning reminder (Sunday 5 PM)"
          >
            {reminderEnabled ? <FaBell size={14} /> : <FaBellSlash size={14} />}
            <span className="hidden sm:inline">Remind to Plan</span>
          </button>

          <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 bg-white dark:bg-zinc-900">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
            >
              <FaChevronLeft size={14} />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
            >
              This Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
            >
              <FaChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Board Area */}
      <div className="flex-1 overflow-hidden flex relative">
         <RoadmapBoard
           startDate={currentSaturday}
           onAddTask={openAddDialog}
           onEditTask={openEditDialog}
         />
      </div>

      <TaskDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialDate={targetDate}
        initialTask={editingTask}
        onSave={handleSaveTask}
      />
    </div>
  );
};
