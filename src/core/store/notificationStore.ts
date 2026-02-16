import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationType = "task_reminder" | "event_reminder" | "system";
export type NotificationStatus = "unread" | "read" | "dismissed";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** ISO date string when the notification should fire */
  scheduledAt: string;
  /** Whether the OS push notification was already sent */
  pushed: boolean;
  status: NotificationStatus;
  /** The linked task or event ID */
  linkedId?: string;
  /** When the notification was created */
  createdAt: number;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isInboxOpen: boolean;

  addNotification: (
    n: Omit<AppNotification, "id" | "createdAt" | "pushed" | "status">,
  ) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  markPushed: (id: string) => void;
  toggleInbox: () => void;
  setInboxOpen: (open: boolean) => void;

  /** Get notifications that are due (scheduledAt <= now) and not yet pushed */
  getDueNotifications: () => AppNotification[];
  /** Get all notifications for the inbox (sorted newest first) */
  getInboxNotifications: () => AppNotification[];
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isInboxOpen: false,

      addNotification: (n) => {
        const id = crypto.randomUUID();
        const notification: AppNotification = {
          ...n,
          id,
          pushed: false,
          status: "unread",
          createdAt: Date.now(),
        };
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
        return id;
      },

      markAsRead: (id) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id && n.status === "unread"
              ? { ...n, status: "read" as NotificationStatus }
              : n,
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => n.status === "unread").length,
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.status === "unread"
              ? { ...n, status: "read" as NotificationStatus }
              : n,
          ),
          unreadCount: 0,
        }));
      },

      dismissNotification: (id) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id
              ? { ...n, status: "dismissed" as NotificationStatus }
              : n,
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => n.status === "unread").length,
          };
        });
      },

      deleteNotification: (id) => {
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id);
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => n.status === "unread").length,
          };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      markPushed: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, pushed: true } : n,
          ),
        }));
      },

      toggleInbox: () => {
        set((state) => ({ isInboxOpen: !state.isInboxOpen }));
      },

      setInboxOpen: (open) => {
        set({ isInboxOpen: open });
      },

      getDueNotifications: () => {
        const now = new Date().toISOString();
        return get().notifications.filter(
          (n) => !n.pushed && n.scheduledAt <= now && n.status !== "dismissed",
        );
      },

      getInboxNotifications: () => {
        return get()
          .notifications.filter((n) => n.status !== "dismissed")
          .sort((a, b) => b.createdAt - a.createdAt);
      },
    }),
    {
      name: "omni-notifications-storage",
    },
  ),
);
