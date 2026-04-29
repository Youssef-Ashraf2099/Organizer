import { useState, useEffect, useRef } from "react";
import { FaChevronLeft } from "@react-icons/all-files/fa/FaChevronLeft";
import { FaChevronRight } from "@react-icons/all-files/fa/FaChevronRight";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaCalendarAlt } from "@react-icons/all-files/fa/FaCalendarAlt";
import { notificationService } from "../../core/services/notificationService";

type RepeatPattern = "daily" | "weekly" | "monthly";

const REPEAT_PATTERNS: { value: RepeatPattern; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  tag: string;
  description?: string;
  linkedTaskId?: string;
  reminder?: string; // ISO datetime for reminder
  repeatEnabled?: boolean;
  repeatPattern?: RepeatPattern;
};

type CalendarOccurrence = CalendarEvent & {
  occurrenceId: string;
  occurrenceDate: string;
};

const occursOnDate = (event: CalendarEvent, dateStr: string) => {
  if (!event.repeatEnabled || !event.repeatPattern) {
    return event.date === dateStr;
  }
  if (dateStr < event.date) return false;

  if (event.repeatPattern === "daily") return true;

  if (event.repeatPattern === "weekly") {
    const eventDate = new Date(`${event.date}T00:00`);
    const targetDate = new Date(`${dateStr}T00:00`);
    const diffDays = Math.floor(
      (targetDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays % 7 === 0;
  }

  // Monthly recurrence is based on day-of-month.
  const eventDay = Number(event.date.split("-")[2]);
  const targetDay = Number(dateStr.split("-")[2]);
  return eventDay === targetDay;
};

const EVENT_TAGS = [
  // Academic
  { name: "quiz",         color: "#3b82f6", label: "📝 Quiz",           group: "Academic" },
  { name: "exam",         color: "#ef4444", label: "📚 Exam",            group: "Academic" },
  { name: "final",        color: "#dc2626", label: "🎓 Final Exam",      group: "Academic" },
  { name: "study",        color: "#6366f1", label: "📖 Study Session",   group: "Academic" },
  { name: "lecture",      color: "#8b5cf6", label: "🏫 Lecture",         group: "Academic" },
  { name: "university",   color: "#7c3aed", label: "🎓 University",      group: "Academic" },
  { name: "workshop",     color: "#a78bfa", label: "🔧 Workshop",        group: "Academic" },
  // Work
  { name: "meeting",      color: "#06b6d4", label: "👥 Meeting",         group: "Work" },
  { name: "deadline",     color: "#f59e0b", label: "⏰ Deadline",        group: "Work" },
  { name: "coding",       color: "#14b8a6", label: "💻 Coding",          group: "Work" },
  { name: "project",      color: "#0ea5e9", label: "📋 Project",         group: "Work" },
  { name: "conference",   color: "#0284c7", label: "🎤 Conference",      group: "Work" },
  { name: "interview",    color: "#38bdf8", label: "🤝 Interview",       group: "Work" },
  { name: "presentation", color: "#0369a1", label: "📊 Presentation",   group: "Work" },
  { name: "volunteer",    color: "#059669", label: "🙌 Volunteer",       group: "Work" },
  // Personal
  { name: "birthday",     color: "#ec4899", label: "🎂 Birthday",        group: "Personal" },
  { name: "hangout",      color: "#10b981", label: "🎉 Hangout",         group: "Personal" },
  { name: "family",       color: "#f472b6", label: "👨‍👩‍👧 Family",          group: "Personal" },
  { name: "social",       color: "#fb7185", label: "🥳 Social Event",    group: "Personal" },
  { name: "travel",       color: "#8b5cf6", label: "✈️ Travel",          group: "Personal" },
  { name: "holiday",      color: "#d946ef", label: "🎄 Holiday",         group: "Personal" },
  { name: "personal",     color: "#6366f1", label: "🏠 Personal",        group: "Personal" },
  { name: "shopping",     color: "#f97316", label: "🛍️ Shopping",        group: "Personal" },
  { name: "food",         color: "#fbbf24", label: "🍽️ Food & Dining",   group: "Personal" },
  { name: "prayer",       color: "#a16207", label: "🤲 Prayer",          group: "Personal" },
  // Health & Fitness
  { name: "gym",          color: "#22c55e", label: "🏋️ Gym & Fitness",  group: "Health" },
  { name: "health",       color: "#f43f5e", label: "⚕️ Health",          group: "Health" },
  { name: "sports",       color: "#84cc16", label: "⚽ Sports",          group: "Health" },
  { name: "appointment",  color: "#e11d48", label: "🏥 Appointment",     group: "Health" },
  // Finance & Misc
  { name: "finance",      color: "#eab308", label: "💰 Finance",         group: "Finance" },
  { name: "music",        color: "#c084fc", label: "🎵 Music",           group: "Misc" },
  { name: "other",        color: "#64748b", label: "📌 Other",           group: "Misc" },
];

const TAG_COLOR_MAP = EVENT_TAGS.reduce(
  (acc, tag) => {
    acc[tag.name] = tag.color;
    return acc;
  },
  {} as Record<string, string>,
);

const TAG_GROUPS = ["Academic", "Work", "Personal", "Health", "Finance", "Misc"] as const;

/* ── Custom Tag Dropdown ─────────────────────────────────── */
const TagDropdown = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedTag = EVENT_TAGS.find((t) => t.name === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2.5 text-zinc-100 transition-colors text-left"
        style={{ borderLeftWidth: "4px", borderLeftColor: selectedTag?.color ?? "#64748b" }}
      >
        <span className="text-lg leading-none">{selectedTag?.label.split(" ")[0]}</span>
        <span className="flex-1 text-sm">{selectedTag?.label.split(" ").slice(1).join(" ")}</span>
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: selectedTag?.color ?? "#64748b" }}
        />
        <svg
          className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown list — opens downward */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ maxHeight: "260px", overflowY: "auto" }}
        >
          {TAG_GROUPS.map((group) => {
            const groupTags = EVENT_TAGS.filter((t) => t.group === group);
            if (!groupTags.length) return null;
            return (
              <div key={group}>
                {/* Group header */}
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-950/60 sticky top-0">
                  {group}
                </div>
                {groupTags.map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => { onChange(tag.name); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                      value === tag.name
                        ? "bg-zinc-700/60 text-white"
                        : "text-zinc-300 hover:bg-zinc-800/80"
                    }`}
                  >
                    {/* Color dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {/* Emoji */}
                    <span className="text-base leading-none">{tag.label.split(" ")[0]}</span>
                    {/* Name */}
                    <span className="flex-1">{tag.label.split(" ").slice(1).join(" ")}</span>
                    {/* Checkmark */}
                    {value === tag.name && (
                      <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Calendar = () => {

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load events from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("calendar-events");
    if (saved) {
      const loadedEvents = JSON.parse(saved);
      console.log("📅 Loaded", loadedEvents.length, "events from localStorage");
      setEvents(loadedEvents);
    } else {
      console.log("📅 No saved events found");
    }
    setIsInitialized(true);
  }, []);

  // Save events to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("calendar-events", JSON.stringify(events));
      console.log("💾 Saved", events.length, "events to localStorage");
    }
  }, [events, isInitialized]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } =
    getDaysInMonth(currentDate);

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateString = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;
  };

  const getEventsForDate = (dateStr: string) => {
    return events
      .filter((e) => occursOnDate(e, dateStr))
      .map((e) => ({
        ...e,
        occurrenceDate: dateStr,
        occurrenceId: `${e.id}:${dateStr}`,
      }))
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isPastDate = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month, day);
    return checkDate < today;
  };

  const addEvent = (event: Omit<CalendarEvent, "id">) => {
    const newId = crypto.randomUUID();
    const newEvent = { ...event, id: newId };
    setEvents([...events, newEvent]);

    // Schedule notification if reminder is set
    if (event.reminder) {
      notificationService.scheduleReminder({
        type: "event_reminder",
        title: `📅 Event Reminder: ${event.title}`,
        body: event.description || `Upcoming: ${event.title}`,
        scheduledAt: new Date(event.reminder).toISOString(),
        linkedId: newId,
      });
    }
  };

  const deleteEvent = (id: string) => {
    if (confirm("Delete this event?")) {
      notificationService.removeRemindersForItem(id);
      setEvents(events.filter((e) => e.id !== id));
    }
  };

  const updateEvent = (id: string, updates: Partial<CalendarEvent>) => {
    setEvents(events.map((e) => (e.id === id ? { ...e, ...updates } : e)));

    // Re-schedule notification if reminder changed
    if (updates.reminder !== undefined) {
      notificationService.removeRemindersForItem(id);
      if (updates.reminder) {
        const event = events.find((e) => e.id === id);
        const title = updates.title || event?.title || "Event";
        notificationService.scheduleReminder({
          type: "event_reminder",
          title: `📅 Event Reminder: ${title}`,
          body:
            updates.description || event?.description || `Upcoming: ${title}`,
          scheduledAt: new Date(updates.reminder).toISOString(),
          linkedId: id,
        });
      }
    }
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="h-20" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = getDateString(day);
    const dayEvents = getEventsForDate(dateStr);
    const today = isToday(day);
    const isPast = isPastDate(day);

    days.push(
      <div
        key={day}
        onClick={() => setSelectedDate(dateStr)}
        className={`relative rounded-xl p-2 cursor-pointer transition-all h-24 flex flex-col gap-1 border border-zinc-800/60 ${
          today
            ? "border-blue-500/50 bg-blue-500/10 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]"
            : isPast
              ? "bg-zinc-900/30 opacity-60"
              : dateStr === selectedDate
                ? "border-zinc-500 bg-zinc-800/50"
                : "bg-zinc-900/40 hover:bg-zinc-800/60"
        }`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`text-xs font-bold ${
              today
                ? "text-blue-400"
                : isPast
                  ? "text-zinc-600"
                  : "text-zinc-300"
            }`}
          >
            {day}
          </span>
          {dayEvents.length > 0 && (
            <span
              className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center ${
                isPast ? "bg-zinc-600" : "bg-blue-600"
              }`}
            >
              {dayEvents.length}
            </span>
          )}
        </div>
        <div className="space-y-1 overflow-hidden flex-1">
          {dayEvents.slice(0, 3).map((event) => (
            <div
              key={event.occurrenceId}
              className={`text-[10px] leading-tight px-1.5 py-1 rounded-md overflow-hidden font-medium ${
                isPast ? "opacity-60" : ""
              }`}
              style={{
                backgroundColor: TAG_COLOR_MAP[event.tag] + "20",
                color: TAG_COLOR_MAP[event.tag],
                borderLeft: `2px solid ${TAG_COLOR_MAP[event.tag]}`,
              }}
              title={event.title}
            >
              <div className="flex items-center gap-1 w-full">
                <span>{EVENT_TAGS.find(t => t.name === event.tag)?.label.split(' ')[0]}</span>
                <span className="truncate">
                  {event.time ? <span className="opacity-70 mr-0.5">{event.time}</span> : null}
                  {event.title}
                </span>
              </div>
            </div>
          ))}
          {dayEvents.length > 3 && (
            <div className="text-[10px] text-zinc-500 px-1 font-medium">
              +{dayEvents.length - 3} more
            </div>
          )}
        </div>
      </div>,
    );
  }

  const selectedEvents: CalendarOccurrence[] = selectedDate
    ? getEventsForDate(selectedDate)
    : [];

  return (
    <div className="calendar-root h-full flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex flex-wrap gap-4 items-center justify-between bg-zinc-900/50">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FaCalendarAlt className="text-blue-500" />
          Calendar & Events
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-900 border border-zinc-700/50 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={prevMonth}
              className="p-2.5 hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
              title="Previous Month"
            >
              <FaChevronLeft size={14} />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-semibold text-white border-l border-r border-zinc-700/50"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-2.5 hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
              title="Next Month"
            >
              <FaChevronRight size={14} />
            </button>
          </div>
          <div className="text-lg font-bold text-zinc-100 min-w-[130px] text-right">
            {monthName}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-3">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-bold text-zinc-400 py-1"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{days}</div>
      </div>

      {/* Day View Modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                📅{" "}
                {new Date(selectedDate + "T00:00").toLocaleDateString(
                  "default",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-4">
              <div className="text-sm text-zinc-400 mb-3">
                {selectedEvents.length} event
                {selectedEvents.length !== 1 ? "s" : ""} scheduled
              </div>

              <div className="space-y-2 mb-4">
                {selectedEvents.length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    <div className="text-3xl mb-2">📭</div>
                    <p className="text-sm">No events for this day</p>
                  </div>
                )}
                {selectedEvents.map((event) => {
                  const tagDef = EVENT_TAGS.find((t) => t.name === event.tag);
                  const emoji = tagDef?.label.split(" ")[0] ?? "📌";
                  const tagColor = TAG_COLOR_MAP[event.tag] ?? "#64748b";
                  return (
                    <div
                      key={event.occurrenceId}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-zinc-800/60"
                      style={{
                        borderLeft: `3px solid ${tagColor}`,
                        background: `linear-gradient(90deg, ${tagColor}10 0%, transparent 60%)`,
                      }}
                    >
                      {/* Emoji icon */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: tagColor + "30" }}
                      >
                        {emoji}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100 truncate">{event.title}</span>
                          {event.repeatEnabled && (
                            <span className="text-[10px] text-emerald-400 border border-emerald-400/40 rounded px-1">🔁 repeat</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {event.time && (
                            <span className="text-xs text-zinc-400">⏰ {event.time}</span>
                          )}
                          <span
                            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: tagColor + "30", color: tagColor }}
                          >
                            {tagDef?.label}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-zinc-500 mt-1 truncate">{event.description}</p>
                        )}
                      </div>

                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => setEditingEvent(event)}
                          className="p-1.5 rounded-lg hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition"
                          title="Edit event"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="p-1.5 rounded-lg hover:bg-red-600/20 text-zinc-500 hover:text-red-400 transition"
                          title="Delete event"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setIsAddingEvent(true);
                  setEditingEvent({
                    id: "",
                    title: "",
                    date: selectedDate,
                    tag: "other",
                    time: "",
                    repeatEnabled: false,
                    repeatPattern: "weekly",
                  });
                }}
                className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded font-medium transition flex items-center justify-center gap-2"
              >
                <FaPlus size={14} />
                Add Another Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Event Modal */}
      {editingEvent && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => {
            setEditingEvent(null);
            setIsAddingEvent(false);
          }}
        >
          <div
            className="bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl w-full max-w-md flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700">
              <h3 className="text-lg font-bold">
                {isAddingEvent ? "Add Event" : "Edit Event"}
              </h3>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, title: e.target.value })
                  }
                  className="w-full bg-zinc-950/50 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-zinc-100 outline-none transition-colors"
                  placeholder="Event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={editingEvent.date}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, date: e.target.value })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Time (optional)
                </label>
                <input
                  type="time"
                  value={editingEvent.time || ""}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, time: e.target.value })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Tag
                </label>
                <TagDropdown
                  value={editingEvent.tag}
                  onChange={(val) => setEditingEvent({ ...editingEvent, tag: val })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={editingEvent.description || ""}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full bg-zinc-950/50 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-zinc-100 outline-none transition-colors resize-none"
                  placeholder="Event details..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  🔔 Reminder (optional)
                </label>
                <input
                  type="datetime-local"
                  value={editingEvent.reminder || ""}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      reminder: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
                />
                {editingEvent.reminder && (
                  <button
                    onClick={() =>
                      setEditingEvent({ ...editingEvent, reminder: undefined })
                    }
                    className="mt-1 text-xs text-red-400 hover:text-red-300 transition"
                  >
                    ✕ Clear reminder
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={Boolean(editingEvent.repeatEnabled)}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        repeatEnabled: e.target.checked,
                        repeatPattern: editingEvent.repeatPattern || "weekly",
                      })
                    }
                    className="w-4 h-4 rounded border-zinc-600 text-blue-600"
                  />
                  Repeat this event
                </label>
                <select
                  value={editingEvent.repeatPattern || "weekly"}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      repeatPattern: e.target.value as RepeatPattern,
                    })
                  }
                  disabled={!editingEvent.repeatEnabled}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 disabled:opacity-50"
                >
                  {REPEAT_PATTERNS.map((pattern) => (
                    <option key={pattern.value} value={pattern.value}>
                      Repeat {pattern.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

              <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setIsAddingEvent(false);
                }}
                className="flex-1 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingEvent.title.trim()) {
                    alert("Please enter a title");
                    return;
                  }
                  if (isAddingEvent) {
                    addEvent(editingEvent);
                  } else {
                    updateEvent(editingEvent.id, editingEvent);
                  }
                  setEditingEvent(null);
                  setIsAddingEvent(false);
                }}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium shadow-[0_0_15px_rgba(37,99,235,0.4)] transition"
              >
                {isAddingEvent ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
