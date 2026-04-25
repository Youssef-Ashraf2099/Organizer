import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaCalendarAlt } from "@react-icons/all-files/fa/FaCalendarAlt";
import { RoadmapTask } from "../../core/store/roadmapStore";
import { RoadmapCard } from "./RoadmapCard";
import { CalendarEventCard, CalendarEventSlim } from "./CalendarEventCard";

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

interface RoadmapColumnProps {
  date: Date;
  tasks: RoadmapTask[];
  calendarEvents: CalendarEventSlim[];
  onAddTask: (dateStr: string) => void;
  onEditTask: (task: RoadmapTask) => void;
  onDeleteTask: (id: string) => void;
}

export const RoadmapColumn = ({
  date,
  tasks,
  calendarEvents,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: RoadmapColumnProps) => {
  const isToday = new Date().toDateString() === date.toDateString();
  const dateStr = toLocalDateKey(date);

  const dayName  = date.toLocaleDateString("en-US", { weekday: "long" });
  const shortDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const doneTasks  = tasks.filter((t) => t.status === "done").length;
  const totalItems = tasks.length + calendarEvents.length;

  // Sort calendar events by time (events without time go last)
  const sortedCalEvents = [...calendarEvents].sort((a, b) =>
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99")
  );

  return (
    <div
      className={`flex flex-col min-w-[270px] w-[270px] border-r flex-shrink-0 ${
        isToday
          ? "border-blue-500/30 bg-blue-900/10"
          : "border-zinc-800 bg-zinc-950/50"
      }`}
    >
      {/* ── Column Header ─────────────────────────────────── */}
      <div
        className={`p-3 border-b sticky top-0 z-10 ${
          isToday
            ? "border-blue-500/30 bg-zinc-900"
            : "border-zinc-800 bg-zinc-950"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <h3
              className={`font-bold text-sm ${
                isToday ? "text-blue-400" : "text-zinc-100"
              }`}
            >
              {dayName}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">{shortDate}</p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Calendar events count badge */}
            {calendarEvents.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                <FaCalendarAlt size={8} />
                {calendarEvents.length}
              </span>
            )}
            {/* Tasks count / done */}
            {tasks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold">
                {doneTasks}/{tasks.length}
              </span>
            )}
            {/* Add task button */}
            <button
              onClick={() => onAddTask(dateStr)}
              className={`p-1.5 rounded-md transition ${
                isToday
                  ? "text-blue-400 hover:bg-blue-500/20"
                  : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800"
              }`}
              title={`Add mission for ${dayName}`}
            >
              <FaPlus size={11} />
            </button>
          </div>
        </div>

        {/* Progress bar (done / total roadmap tasks) */}
        {tasks.length > 0 && (
          <div className="h-0.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(doneTasks / tasks.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="flex-1 p-2.5 flex flex-col gap-2 overflow-y-auto min-h-[500px]">

        {/* Calendar events (read-only, top section) */}
        {sortedCalEvents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {sortedCalEvents.map((ev) => (
              <CalendarEventCard key={ev.id} event={ev} />
            ))}
            {/* Divider before roadmap tasks */}
            {tasks.length > 0 && (
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest">
                  missions
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
            )}
          </div>
        )}

        {/* Roadmap tasks */}
        {tasks.map((task) => (
          <RoadmapCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}

        {/* Empty state */}
        {totalItems === 0 && (
          <div
            onClick={() => onAddTask(dateStr)}
            className="border-2 border-dashed border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center text-zinc-600 hover:bg-zinc-900/50 hover:border-zinc-700 cursor-pointer transition min-h-[100px] gap-2"
          >
            <FaPlus size={14} />
            <span className="text-[11px]">No missions</span>
          </div>
        )}

        {/* Show add-task area when there are only calendar events */}
        {totalItems > 0 && tasks.length === 0 && (
          <button
            onClick={() => onAddTask(dateStr)}
            className="text-[11px] text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 border border-dashed border-zinc-800 hover:border-zinc-700 rounded-lg py-2 transition flex items-center justify-center gap-1"
          >
            <FaPlus size={10} /> Add mission
          </button>
        )}
      </div>
    </div>
  );
};
