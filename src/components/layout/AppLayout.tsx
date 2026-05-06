import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getSharedDb } from "../../core/db/sqlite";
import { Sidebar } from "../../features/sidebar/Sidebar";
import { OmniEditor } from "../../features/editor/OmniEditor";
import { cn } from "../../lib/utils";
import { usePageStore } from "../../core/store/pageStore";
import { FaListUl } from "@react-icons/all-files/fa/FaListUl";
import { FaCalendarAlt } from "@react-icons/all-files/fa/FaCalendarAlt";
import { FaBookOpen } from "@react-icons/all-files/fa/FaBookOpen";
import { FaCrosshairs } from "@react-icons/all-files/fa/FaCrosshairs";
import { FaInbox } from "@react-icons/all-files/fa/FaInbox";
import { FaSpinner } from "@react-icons/all-files/fa/FaSpinner";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaWallet } from "@react-icons/all-files/fa/FaWallet";
import { FaCog } from "@react-icons/all-files/fa/FaCog";
import { FaProjectDiagram } from "@react-icons/all-files/fa/FaProjectDiagram";
import { TodoList } from "../../features/todo/TodoList";
import { TodayObjective } from "../../features/todo/TodayObjective";
import { Calendar } from "../../features/calendar/Calendar";
import { WeeklyRoadmap } from "../../features/roadmap/WeeklyRoadmap";
import { BudgetTracker } from "../../features/budget/BudgetTracker";
import { DiagramStudio } from "../../features/diagrams/DiagramStudio";
import { Settings } from "../../features/settings/Settings";
import { FaMapSigns } from "@react-icons/all-files/fa/FaMapSigns";
import { motion, AnimatePresence } from "framer-motion";
import {
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  NotificationBell,
  NotificationInbox,
} from "../../features/notifications/NotificationInbox";
import { notificationService } from "../../core/services/notificationService";
import {
  getTodayObjectiveStats,
  useObjectiveStore,
} from "../../core/store/objectiveStore";
import { markdownToBlocks } from "../../features/editor/markdownParser";
import { AiAgentPanel } from "../../features/ai/AiAgentPanel";
import { useAiAgent } from "../../features/ai/useAiAgent";

type RightPanelView =
  | "editor"
  | "todo"
  | "calendar"
  | "budget"
  | "diagrams"
  | "objective"
  | "settings"
  | "roadmap";

type TodoColumn = "backlog" | "todo" | "inprogress" | "done";
type TodoCounts = Record<TodoColumn, number>;

const emptyTodoCounts: TodoCounts = {
  backlog: 0,
  todo: 0,
  inprogress: 0,
  done: 0,
};

const loadTodoCounts = (): TodoCounts => {
  try {
    const raw = localStorage.getItem("personal-todos");
    if (!raw) return { ...emptyTodoCounts };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ...emptyTodoCounts };
    return parsed.reduce(
      (acc: TodoCounts, todo: any) => {
        const column = todo?.column as TodoColumn | undefined;
        if (column && acc[column] !== undefined) {
          acc[column] += 1;
        }
        return acc;
      },
      { ...emptyTodoCounts },
    );
  } catch {
    return { ...emptyTodoCounts };
  }
};

const todayDateKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

const titleFromPath = (filePath: string) => {
  const fileName = filePath.split(/[/\\]/).pop() || "Untitled";
  return fileName.replace(/\.(md|markdown)$/i, "") || "Untitled";
};

export const AppLayout = () => {
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [rightPanelView, setRightPanelView] =
    useState<RightPanelView>("editor");
  const [calendarNudge, setCalendarNudge] = useState(true);
  const [todoCounts, setTodoCounts] = useState<TodoCounts>(emptyTodoCounts);
  const isDragging = useRef(false);
  const addPage = usePageStore((s) => s.addPage);
  const updatePageTitle = usePageStore((s) => s.updatePageTitle);
  const setActivePage = usePageStore((s) => s.setActivePage);

  // Subscribe to raw objectives array to avoid infinite loop from selector returning new array ref
  const objectives = useObjectiveStore((s) => s.objectives);
  const objectiveStats = useMemo(() => {
    const todayKey = todayDateKey();
    const todayObjectives = objectives.filter(
      (obj) => obj.objectiveDate === todayKey,
    );
    return getTodayObjectiveStats(todayObjectives);
  }, [objectives]);
  const startupMarkdownHandledRef = useRef(false);
  const showPageSidebar =
    rightPanelView === "editor" || rightPanelView === "diagrams";

  // Start notification service on mount
  useEffect(() => {
    notificationService.start();
    return () => notificationService.stop();
  }, []);

  // Enable autostart on Windows login (safe to call on other platforms)
  useEffect(() => {
    const ensureAutostart = async () => {
      try {
        const enabled = await isAutostartEnabled();
        if (!enabled) {
          await enableAutostart();
        }
      } catch (e) {
        console.warn("Autostart not available:", e);
      }
    };

    ensureAutostart();
  }, []);

  // Encourage opening Calendar on each app launch
  useEffect(() => {
    try {
      const calendarSeen = sessionStorage.getItem("omni-seen-calendar") === "1";
      setCalendarNudge(!calendarSeen);
    } catch {
      setCalendarNudge(true);
    }
  }, []);

  useEffect(() => {
    if (rightPanelView === "calendar" && calendarNudge) {
      setCalendarNudge(false);
      try {
        sessionStorage.setItem("omni-seen-calendar", "1");
      } catch {
        // Ignore storage errors
      }
    }
  }, [rightPanelView, calendarNudge]);

  useEffect(() => {
    const updateCounts = () => {
      setTodoCounts(loadTodoCounts());
    };

    updateCounts();

    const handleCounts = (event: Event) => {
      const custom = event as CustomEvent<{ counts?: TodoCounts }>;
      if (custom.detail?.counts) {
        setTodoCounts(custom.detail.counts);
      } else {
        updateCounts();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "personal-todos") {
        updateCounts();
      }
    };

    window.addEventListener("todoCountsUpdated", handleCounts);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("todoCountsUpdated", handleCounts);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (startupMarkdownHandledRef.current) return;
    startupMarkdownHandledRef.current = true;

    const openStartupMarkdownFiles = async () => {
      if (!isTauriRuntime()) return;

      try {
        const startupFiles = await invoke<string[]>(
          "get_launch_markdown_files",
        );
        if (!Array.isArray(startupFiles) || startupFiles.length === 0) return;

        const db = await getSharedDb();

        for (const filePath of startupFiles) {
          const markdown = await invoke<string>("read_markdown_file", {
            filePath,
          });

          const pageId = await addPage(null, null);
          if (!pageId) continue;

          const title = titleFromPath(filePath);
          await updatePageTitle(pageId, title);

          const parsedBlocks = markdownToBlocks(markdown);
          const nextBlocks =
            parsedBlocks.length > 0
              ? parsedBlocks
              : [
                  {
                    type: "paragraph",
                    content: markdown.trim() || "",
                  },
                ];

          const contentJson = JSON.stringify(nextBlocks);
          const existing = await db.select<any[]>(
            "SELECT id FROM blocks WHERE page_id = $1",
            [pageId],
          );

          if (existing.length > 0) {
            await db.execute(
              "UPDATE blocks SET content = $1 WHERE page_id = $2",
              [contentJson, pageId],
            );
          } else {
            await db.execute(
              "INSERT INTO blocks (id, page_id, content, sort_order) VALUES ($1, $2, $3, $4)",
              [crypto.randomUUID(), pageId, contentJson, 0],
            );
          }

          setActivePage(pageId);
        }

        setRightPanelView("editor");
      } catch (error) {
        console.error("Failed to open startup markdown files:", error);
      }
    };

    openStartupMarkdownFiles();
  }, [addPage, setActivePage, updatePageTitle]);

  const startResizing = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopResizing = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isDragging.current) {
      setSidebarWidth(() => {
        const newWidth = mouseMoveEvent.clientX;
        if (newWidth < 150) return 150;
        if (newWidth > 600) return 600;
        return newWidth;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div className="app-shell h-screen w-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        {showPageSidebar && (
          <motion.aside
            key="page-sidebar"
            layout
            initial={{ opacity: 0, x: -18, width: 0 }}
            animate={{ opacity: 1, x: 0, width: sidebarWidth }}
            exit={{ opacity: 0, x: -18, width: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="flex-shrink-0 flex flex-col h-full overflow-hidden no-print"
          >
            <Sidebar view={rightPanelView} />
          </motion.aside>
        )}

        {showPageSidebar && (
          <motion.div
            key="sidebar-resizer"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            onMouseDown={startResizing}
            className={cn(
              "w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-50 no-print",
              isDragging.current
                ? "bg-blue-500"
                : "bg-zinc-200 dark:bg-zinc-800",
            )}
          />
        )}
      </AnimatePresence>

      {/* Right Panel with Tabs */}
      <motion.div
        layout
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className="flex-1 h-full min-w-0 flex flex-col overflow-hidden relative"
      >
        {/* Tab Buttons at Top */}
        <div className="app-topbar flex items-center border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur no-print">
          <div className="flex flex-1 gap-1 px-2 py-2 overflow-x-auto">
            <button
              onClick={() => setRightPanelView("editor")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl whitespace-nowrap",
                rightPanelView === "editor"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaBookOpen size={14} />
              Pages
            </button>
            <button
              onClick={() => setRightPanelView("todo")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl whitespace-nowrap",
                rightPanelView === "todo"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaListUl size={14} />
              To-Do
              {(todoCounts.backlog > 0 ||
                todoCounts.todo > 0 ||
                todoCounts.inprogress > 0 ||
                todoCounts.done > 0) && (
                <span className="ml-2 flex items-center gap-1">
                  {todoCounts.backlog > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-semibold">
                      <FaInbox size={10} />
                      {todoCounts.backlog}
                    </span>
                  )}
                  {todoCounts.todo > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-500 text-[10px] font-semibold">
                      <FaListUl size={10} />
                      {todoCounts.todo}
                    </span>
                  )}
                  {todoCounts.inprogress > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-semibold">
                      <FaSpinner size={10} className="animate-spin" />
                      {todoCounts.inprogress}
                    </span>
                  )}
                  {todoCounts.done > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold">
                      <FaCheck size={10} />
                      {todoCounts.done}
                    </span>
                  )}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanelView("calendar")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl relative whitespace-nowrap",
                rightPanelView === "calendar"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaCalendarAlt size={14} />
              Calendar
              {calendarNudge && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanelView("budget")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl whitespace-nowrap",
                rightPanelView === "budget"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaWallet size={14} />
              Budget
            </button>
            <button
              onClick={() => setRightPanelView("diagrams")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl whitespace-nowrap",
                rightPanelView === "diagrams"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaProjectDiagram size={14} />
              Diagrams
            </button>
            <button
              onClick={() => setRightPanelView("roadmap")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl whitespace-nowrap",
                rightPanelView === "roadmap"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaMapSigns size={14} />
              Roadmap
            </button>
            <button
              onClick={() => setRightPanelView("objective")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl whitespace-nowrap",
                rightPanelView === "objective"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaCrosshairs size={14} />
              Today Objective
              {objectiveStats.total > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-500 text-[10px] font-semibold">
                  {objectiveStats.completed}/{objectiveStats.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanelView("settings")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 rounded-xl whitespace-nowrap",
                rightPanelView === "settings"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
              )}
            >
              <FaCog size={14} />
              Settings
            </button>
          </div>

          {calendarNudge && (
            <div className="flex items-center gap-2 px-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Start here
              </span>
              {calendarNudge && (
                <button
                  onClick={() => setRightPanelView("calendar")}
                  className="text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition"
                >
                  Calendar
                </button>
              )}
            </div>
          )}

          {/* AI Agent Toggle */}
          <div className="relative px-1">
            <AiAgentToggleButton />
          </div>

          {/* Notification Bell */}
          <div className="relative px-3">
            <NotificationBell />
            <NotificationInbox />
          </div>
        </div>

        {/* Content Area */}
        <div className="app-content flex-1 overflow-y-scroll relative bg-white dark:bg-zinc-950">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={rightPanelView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {rightPanelView === "editor" && (
                <OmniEditor onSelectText={() => {}} />
              )}
              {rightPanelView === "todo" && <TodoList />}
              {rightPanelView === "calendar" && <Calendar />}
              {rightPanelView === "budget" && <BudgetTracker />}
              {rightPanelView === "diagrams" && <DiagramStudio />}
              {rightPanelView === "roadmap" && <WeeklyRoadmap />}
              {rightPanelView === "objective" && <TodayObjective />}
              {rightPanelView === "settings" && <Settings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* AI Agent Panel — slides in from the right */}
      <AiAgentPanel />
    </div>
  );
};

// ─── AI Agent Toggle Button ───────────────────────────────────────────────────
const AiAgentToggleButton = () => {
  const { isOpen, togglePanel, pendingChanges } = useAiAgent();
  return (
    <button
      id="ai-agent-toggle"
      onClick={togglePanel}
      title={isOpen ? "Close AI Agent" : "Open AI Agent"}
      className={cn(
        "relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
        isOpen
          ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-600/30"
          : "bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 border border-zinc-200/80 dark:border-zinc-700",
      )}
    >
      <span className={cn("text-base leading-none", isOpen && "animate-pulse")}>
        ✨
      </span>
      <span className="hidden sm:inline whitespace-nowrap">AI Agent</span>
      {pendingChanges.length > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shadow">
          {pendingChanges.length}
        </span>
      )}
    </button>
  );
};
