import { useState, useEffect } from "react";
import { FaChevronLeft } from "@react-icons/all-files/fa/FaChevronLeft";
import { FaChevronRight } from "@react-icons/all-files/fa/FaChevronRight";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  tag: string;
  description?: string;
  linkedTaskId?: string;
};

const EVENT_TAGS = [
  { name: "quiz", color: "#3b82f6", label: "📝 Quiz" },
  { name: "university", color: "#8b5cf6", label: "🎓 University" },
  { name: "final", color: "#ef4444", label: "📚 Final" },
  { name: "meeting", color: "#06b6d4", label: "👥 Meeting" },
  { name: "deadline", color: "#f59e0b", label: "⏰ Deadline" },
  { name: "birthday", color: "#ec4899", label: "🎂 Birthday" },
  { name: "hangout", color: "#10b981", label: "🎉 Hangout" },
  { name: "other", color: "#64748b", label: "📌 Other" },
];

const TAG_COLOR_MAP = EVENT_TAGS.reduce((acc, tag) => {
  acc[tag.name] = tag.color;
  return acc;
}, {} as Record<string, string>);

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
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateString = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
  };

  const getEventsForDate = (dateStr: string) => {
    return events.filter((e) => e.date === dateStr);
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
    setEvents([...events, { ...event, id: crypto.randomUUID() }]);
  };

  const deleteEvent = (id: string) => {
    if (confirm("Delete this event?")) {
      setEvents(events.filter((e) => e.id !== id));
    }
  };

  const updateEvent = (id: string, updates: Partial<CalendarEvent>) => {
    setEvents(events.map((e) => (e.id === id ? { ...e, ...updates } : e)));
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
        className={`rounded-lg border-2 p-1.5 cursor-pointer transition h-20 ${
          today
            ? "border-yellow-500 bg-yellow-500/10"
            : isPast
            ? "border-zinc-800/50 bg-zinc-900/30 opacity-60"
            : dateStr === selectedDate
            ? "border-blue-500 bg-blue-500/10"
            : "border-zinc-800 hover:border-zinc-700"
        }`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`text-xs font-bold ${
              today
                ? "text-yellow-500"
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
        <div className="space-y-0.5">
          {dayEvents.slice(0, 1).map((event) => (
            <div
              key={event.id}
              className={`text-[10px] px-1 py-0.5 rounded truncate ${
                isPast ? "opacity-70" : ""
              }`}
              style={{
                backgroundColor: TAG_COLOR_MAP[event.tag] + "40",
                color: TAG_COLOR_MAP[event.tag],
              }}
              title={event.title}
            >
              {event.title}
            </div>
          ))}
          {dayEvents.length > 1 && (
            <div className="text-[10px] text-zinc-500 px-1">
              +{dayEvents.length - 1} more
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          📅 Calendar & Events
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-zinc-800 rounded transition"
          >
            <FaChevronLeft size={16} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-zinc-800 rounded transition"
          >
            <FaChevronRight size={16} />
          </button>
          <span className="text-lg font-semibold ml-2">{monthName}</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto p-3">
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-zinc-900 rounded-lg border-2 border-blue-600 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
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
                  }
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

              <div className="space-y-3 mb-4">
                {selectedEvents.map((event) => {
                  const tagDef = EVENT_TAGS.find((t) => t.name === event.tag);
                  return (
                    <div
                      key={event.id}
                      className="border-2 rounded-lg p-3"
                      style={{ borderColor: TAG_COLOR_MAP[event.tag] }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{
                              backgroundColor: TAG_COLOR_MAP[event.tag],
                            }}
                          >
                            {tagDef?.label.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-zinc-100">
                              {event.title}
                            </h4>
                            {event.time && (
                              <div className="text-sm text-zinc-400">
                                ⏰ {event.time}
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className="px-2 py-1 rounded text-xs font-bold uppercase"
                          style={{
                            backgroundColor: TAG_COLOR_MAP[event.tag] + "40",
                            color: TAG_COLOR_MAP[event.tag],
                          }}
                        >
                          {tagDef?.label}
                        </div>
                      </div>

                      {event.description && (
                        <p className="text-sm text-zinc-400 mb-2">
                          {event.description}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingEvent(event)}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition"
                        >
                          👁️ View Details
                        </button>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="px-3 py-2 hover:bg-zinc-800 rounded transition"
                        >
                          <FaTrash size={14} />
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => {
            setEditingEvent(null);
            setIsAddingEvent(false);
          }}
        >
          <div
            className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-md m-4"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
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
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TAGS.map((tag) => (
                    <button
                      key={tag.name}
                      onClick={() =>
                        setEditingEvent({ ...editingEvent, tag: tag.name })
                      }
                      className={`px-3 py-2 rounded text-sm font-medium transition ${
                        editingEvent.tag === tag.name
                          ? "text-white"
                          : "opacity-50 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor:
                          editingEvent.tag === tag.name
                            ? tag.color
                            : tag.color + "40",
                      }}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
                  placeholder="Event details..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-zinc-700 flex gap-2">
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setIsAddingEvent(false);
                }}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded transition"
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
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
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
