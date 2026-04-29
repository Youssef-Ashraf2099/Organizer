import { useState, useMemo, useEffect } from "react";
import { FaChevronLeft } from "@react-icons/all-files/fa/FaChevronLeft";
import { FaChevronRight } from "@react-icons/all-files/fa/FaChevronRight";
import { FaBell } from "@react-icons/all-files/fa/FaBell";
import { FaBellSlash } from "@react-icons/all-files/fa/FaBellSlash";
import { FaMapSigns } from "@react-icons/all-files/fa/FaMapSigns";
import { FaCalendarAlt } from "@react-icons/all-files/fa/FaCalendarAlt";
import { FaCheckDouble } from "@react-icons/all-files/fa/FaCheckDouble";
import { FaShieldAlt } from "@react-icons/all-files/fa/FaShieldAlt";
import { RoadmapBoard } from "./RoadmapBoard";
import { TaskDialog } from "./TaskDialog";
import { useRoadmapStore, RoadmapTask } from "../../core/store/roadmapStore";
import { notificationService } from "../../core/services/notificationService";

export const WeeklyRoadmap = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const tasks = useRoadmapStore((state) => state.tasks);
  const addTask = useRoadmapStore((state) => state.addTask);
  const updateTask = useRoadmapStore((state) => state.updateTask);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RoadmapTask | undefined>();
  const [targetDate, setTargetDate] = useState<string | undefined>();

  const [reminderEnabled, setReminderEnabled] = useState(() => {
    return localStorage.getItem("omni-roadmap-reminder") === "true";
  });

  const [calendarCount, setCalendarCount] = useState(0);

  const getSaturday = (d: Date) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = date.getDate() - ((day + 1) % 7);
    const res = new Date(date.setDate(diff));
    return res;
  };

  const currentSaturday = useMemo(
    () => getSaturday(currentDate),
    [currentDate],
  );

  const currentSunday = useMemo(() => {
    const d = new Date(currentSaturday);
    d.setDate(d.getDate() + 6);
    return d;
  }, [currentSaturday]);

  // Compute tactical stats for the week
  const weekStats = useMemo(() => {
    const start = currentSaturday.toISOString().split("T")[0];
    const end = currentSunday.toISOString().split("T")[0];

    const weekTasks = tasks.filter((t) => t.date >= start && t.date <= end);
    const doneTasks = weekTasks.filter((t) => t.status === "done").length;

    return {
      total: weekTasks.length,
      done: doneTasks,
      pending: weekTasks.length - doneTasks,
    };
  }, [tasks, currentSaturday, currentSunday]);

  useEffect(() => {
    // Count calendar events for the week
    const countCalEvents = () => {
      try {
        const raw = localStorage.getItem("calendar-events");
        if (!raw) return 0;
        const events = JSON.parse(raw);
        const start = currentSaturday.toISOString().split("T")[0];
        const end = currentSunday.toISOString().split("T")[0];
        return events.filter((e: any) => e.date >= start && e.date <= end)
          .length;
      } catch {
        return 0;
      }
    };

    setCalendarCount(countCalEvents());

    const onStorage = (e: StorageEvent) => {
      if (e.key === "calendar-events") setCalendarCount(countCalEvents());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [currentSaturday, currentSunday]);

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

    if (newState) {
      const permItem = await notificationService.requestPermission();
      if (!permItem) return;
    }

    setReminderEnabled(newState);
    localStorage.setItem("omni-roadmap-reminder", newState.toString());

    if (newState) {
      const nextSunday = new Date();
      nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
      nextSunday.setHours(17, 0, 0, 0);

      if (nextSunday.getTime() <= Date.now()) {
        nextSunday.setDate(nextSunday.getDate() + 7);
      }

      notificationService.scheduleReminder({
        type: "task_reminder",
        title: "Tactical Planning",
        body: "Time to update the Weekly Roadmap and secure upcoming objectives.",
        scheduledAt: nextSunday.toISOString(),
        linkedId: "weekly-roadmap-reminder",
      });
    } else {
      notificationService.removeRemindersForItem("weekly-roadmap-reminder");
    }
  };

  return (
    <div className="roadmap-root h-full flex flex-col bg-zinc-950">
      {/* ── Tactical Header ───────────────────────────────────────── */}
      <div className="px-6 py-4 flex flex-col gap-4 border-b border-zinc-800 bg-zinc-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <FaShieldAlt size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                Tactical Roadmap
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Operation Window
                </span>
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {weekLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Intel Strip */}
            <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg">
              <div
                className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold"
                title="Total Missions"
              >
                <FaMapSigns size={12} className="text-blue-400" />
                <span>{weekStats.total}</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div
                className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold"
                title="Completed Missions"
              >
                <FaCheckDouble size={12} className="text-emerald-500" />
                <span>{weekStats.done}</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div
                className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold"
                title="Calendar Events"
              >
                <FaCalendarAlt size={12} className="text-purple-400" />
                <span>{calendarCount}</span>
              </div>
            </div>

            <button
              onClick={toggleReminder}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border ${
                reminderEnabled
                  ? "border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                  : "border-zinc-700 text-zinc-400 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
              title="Toggle weekly tactical planning reminder (Sunday 17:00)"
            >
              {reminderEnabled ? (
                <FaBell size={12} />
              ) : (
                <FaBellSlash size={12} />
              )}
              <span className="hidden sm:inline">Alerts</span>
            </button>

            <div className="flex items-center gap-1 border border-zinc-700 rounded-lg p-1 bg-zinc-800">
              <button
                onClick={handlePrevWeek}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition"
              >
                <FaChevronLeft size={12} />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-zinc-700 rounded transition"
              >
                Current Ops
              </button>
              <button
                onClick={handleNextWeek}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition"
              >
                <FaChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Board Area ───────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex relative bg-zinc-950">
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
