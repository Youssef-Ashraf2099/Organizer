import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaBell } from "@react-icons/all-files/fa/FaBell";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaCalendar } from "@react-icons/all-files/fa/FaCalendar";
import { FaTasks } from "@react-icons/all-files/fa/FaTasks";
import {
  useNotificationStore,
  AppNotification,
} from "../../core/store/notificationStore";

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function scheduledTimeDisplay(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "Overdue";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `In ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `In ${hrs}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const NotificationIcon = ({ type }: { type: AppNotification["type"] }) => {
  switch (type) {
    case "task_reminder":
      return (
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <FaTasks className="text-blue-400" size={14} />
        </div>
      );
    case "event_reminder":
      return (
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <FaCalendar className="text-purple-400" size={14} />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-lg bg-zinc-500/20 flex items-center justify-center flex-shrink-0">
          <FaBell className="text-zinc-400" size={14} />
        </div>
      );
  }
};

export const NotificationBell = () => {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const toggleInbox = useNotificationStore((s) => s.toggleInbox);
  const isInboxOpen = useNotificationStore((s) => s.isInboxOpen);

  return (
    <button
      onClick={toggleInbox}
      className={`relative p-2 rounded-lg transition hover:bg-white/10 ${
        isInboxOpen
          ? "bg-white/10 text-white"
          : "text-zinc-400 hover:text-white"
      }`}
      title="Notifications"
    >
      <FaBell size={16} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export const NotificationInbox = () => {
  const isOpen = useNotificationStore((s) => s.isInboxOpen);
  const setInboxOpen = useNotificationStore((s) => s.setInboxOpen);
  const getInboxNotifications = useNotificationStore(
    (s) => s.getInboxNotifications,
  );
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setInboxOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, setInboxOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInboxOpen(false);
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, setInboxOpen]);

  const notifications = getInboxNotifications();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 top-full mt-2 w-[380px] max-h-[70vh] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <FaBell className="text-blue-400" size={14} />
              <h3 className="text-sm font-semibold text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] px-2 py-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                  title="Mark all read"
                >
                  <FaCheck size={10} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] px-2 py-1 text-zinc-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition"
                  title="Clear all"
                >
                  <FaTrash size={10} />
                </button>
              )}
              <button
                onClick={() => setInboxOpen(false)}
                className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <FaTimes size={12} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <FaBell size={32} className="mb-3 text-zinc-700" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1 text-zinc-600">
                  Set reminders on tasks and events
                </p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((n) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition cursor-pointer group ${
                      n.status === "unread"
                        ? "bg-blue-500/5 border-l-2 border-blue-500"
                        : "border-l-2 border-transparent"
                    }`}
                    onClick={() => markAsRead(n.id)}
                  >
                    <NotificationIcon type={n.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-medium truncate ${
                            n.status === "unread"
                              ? "text-white"
                              : "text-zinc-300"
                          }`}
                        >
                          {n.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition flex-shrink-0"
                        >
                          <FaTimes size={10} />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-500">
                          {timeAgo(n.createdAt)}
                        </span>
                        {!n.pushed && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                            {scheduledTimeDisplay(n.scheduledAt)}
                          </span>
                        )}
                        {n.status === "unread" && (
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
