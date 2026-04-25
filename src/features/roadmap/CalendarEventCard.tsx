import { FaLock } from "@react-icons/all-files/fa/FaLock";

/** Mirrors the shape stored in localStorage["calendar-events"] */
export interface CalendarEventSlim {
  id: string;
  title: string;
  date: string;      // YYYY-MM-DD
  time?: string;     // HH:MM
  tag: string;
  description?: string;
}

/* ── colour map mirrored from Calendar.tsx ────────────────── */
const TAG_COLORS: Record<string, string> = {
  quiz:         "#3b82f6",
  exam:         "#ef4444",
  final:        "#dc2626",
  study:        "#6366f1",
  lecture:      "#8b5cf6",
  university:   "#7c3aed",
  workshop:     "#a78bfa",
  meeting:      "#06b6d4",
  deadline:     "#f59e0b",
  coding:       "#14b8a6",
  project:      "#0ea5e9",
  conference:   "#0284c7",
  interview:    "#38bdf8",
  presentation: "#0369a1",
  volunteer:    "#059669",
  birthday:     "#ec4899",
  hangout:      "#10b981",
  family:       "#f472b6",
  social:       "#fb7185",
  travel:       "#8b5cf6",
  holiday:      "#d946ef",
  personal:     "#6366f1",
  shopping:     "#f97316",
  food:         "#fbbf24",
  prayer:       "#a16207",
  gym:          "#22c55e",
  health:       "#f43f5e",
  sports:       "#84cc16",
  appointment:  "#e11d48",
  finance:      "#eab308",
  music:        "#c084fc",
  other:        "#64748b",
};

const TAG_EMOJIS: Record<string, string> = {
  quiz: "📝", exam: "📚", final: "🎓", study: "📖", lecture: "🏫",
  university: "🎓", workshop: "🔧", meeting: "👥", deadline: "⏰",
  coding: "💻", project: "📋", conference: "🎤", interview: "🤝",
  presentation: "📊", volunteer: "🙌", birthday: "🎂", hangout: "🎉",
  family: "👨‍👩‍👧", social: "🥳", travel: "✈️", holiday: "🎄",
  personal: "🏠", shopping: "🛍️", food: "🍽️", prayer: "🤲",
  gym: "🏋️", health: "⚕️", sports: "⚽", appointment: "🏥",
  finance: "💰", music: "🎵", other: "📌",
};

interface CalendarEventCardProps {
  event: CalendarEventSlim;
}

export const CalendarEventCard = ({ event }: CalendarEventCardProps) => {
  const color  = TAG_COLORS[event.tag]  ?? "#64748b";
  const emoji  = TAG_EMOJIS[event.tag]  ?? "📌";

  return (
    <div
      className="rounded-xl border p-2.5 flex flex-col gap-1.5 relative select-none"
      style={{
        borderColor: color + "60",
        background: color + "12",
      }}
    >
      {/* Lock badge */}
      <div
        className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: color + "25", color }}
      >
        <FaLock size={7} />
        Calendar
      </div>

      {/* Tag emoji + label */}
      <div className="flex items-center gap-1.5 pr-14">
        <span className="text-sm leading-none">{emoji}</span>
        <span
          className="text-[10px] font-bold uppercase tracking-wide"
          style={{ color }}
        >
          {event.tag}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-zinc-100 leading-tight line-clamp-2">
        {event.title}
      </h4>

      {/* Time */}
      {event.time && (
        <div className="text-xs text-zinc-400 flex items-center gap-1">
          ⏰ {event.time}
        </div>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
          {event.description}
        </p>
      )}
    </div>
  );
};
