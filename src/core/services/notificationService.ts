import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useNotificationStore } from "../store/notificationStore";

/** Interval (ms) for checking due notifications */
const CHECK_INTERVAL = 30_000; // 30 seconds

let checkTimerId: ReturnType<typeof setInterval> | null = null;

/**
 * NotificationService — manages reminder scheduling and Windows push notifications.
 *
 * Call `notificationService.start()` once at app startup.
 * It polls the notification store every 30s for items whose
 * `scheduledAt` has passed, then fires a Windows notification.
 */
export const notificationService = {
  /** Request notification permission from the OS */
  async requestPermission(): Promise<boolean> {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      return granted;
    } catch (e) {
      console.warn("Notification permission check failed:", e);
      return false;
    }
  },

  /** Send a Windows push notification */
  async push(title: string, body: string): Promise<void> {
    try {
      const granted = await isPermissionGranted();
      if (!granted) {
        console.warn("Notifications not permitted");
        return;
      }
      sendNotification({ title, body });
    } catch (e) {
      console.error("Failed to send notification:", e);
    }
  },

  /** Check for due notifications and fire them */
  async checkDueNotifications(): Promise<void> {
    const store = useNotificationStore.getState();
    const due = store.getDueNotifications();

    for (const n of due) {
      await this.push(n.title, n.body);
      store.markPushed(n.id);
    }
  },

  /**
   * Schedule a reminder notification.
   * Creates the notification in the store. The background poller
   * will fire the Windows push when `scheduledAt` arrives.
   */
  scheduleReminder(opts: {
    type: "task_reminder" | "event_reminder";
    title: string;
    body: string;
    scheduledAt: string; // ISO string
    linkedId?: string;
  }): string {
    const store = useNotificationStore.getState();
    return store.addNotification({
      type: opts.type,
      title: opts.title,
      body: opts.body,
      scheduledAt: opts.scheduledAt,
      linkedId: opts.linkedId,
    });
  },

  /**
   * Remove all reminders linked to a specific task/event ID.
   */
  removeRemindersForItem(linkedId: string): void {
    const store = useNotificationStore.getState();
    const toRemove = store.notifications.filter(
      (n) => n.linkedId === linkedId && !n.pushed,
    );
    for (const n of toRemove) {
      store.deleteNotification(n.id);
    }
  },

  /** Start the background poller. Call once at app startup. */
  start(): void {
    if (checkTimerId) return; // Already running

    // Request permission on first start
    this.requestPermission();

    // Initial check
    this.checkDueNotifications();

    // Poll every CHECK_INTERVAL
    checkTimerId = setInterval(() => {
      this.checkDueNotifications();
    }, CHECK_INTERVAL);

    console.log("🔔 NotificationService started");
  },

  /** Stop the background poller */
  stop(): void {
    if (checkTimerId) {
      clearInterval(checkTimerId);
      checkTimerId = null;
    }
  },
};
