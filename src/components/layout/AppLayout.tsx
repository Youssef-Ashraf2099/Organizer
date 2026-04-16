import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Sidebar } from "../../features/sidebar/Sidebar";
import { OmniEditor } from "../../features/editor/OmniEditor";
import { AgentPanel } from "../../features/ai/AgentPanel";
import { useAgentPanel } from "../../features/ai/useAgentPanel";
import { cn } from "../../lib/utils";
import { usePageStore } from "../../core/store/pageStore";
import { FaRobot } from "@react-icons/all-files/fa/FaRobot";
import { FaListUl } from "@react-icons/all-files/fa/FaListUl";
import { FaCalendarAlt } from "@react-icons/all-files/fa/FaCalendarAlt";
import { FaBookOpen } from "@react-icons/all-files/fa/FaBookOpen";
import { FaComments } from "@react-icons/all-files/fa/FaComments";
import { FaCrosshairs } from "@react-icons/all-files/fa/FaCrosshairs";
import { FaInbox } from "@react-icons/all-files/fa/FaInbox";
import { FaSpinner } from "@react-icons/all-files/fa/FaSpinner";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaWallet } from "@react-icons/all-files/fa/FaWallet";
import { FaProjectDiagram } from "@react-icons/all-files/fa/FaProjectDiagram";
import { TodoList } from "../../features/todo/TodoList";
import { TodayObjective } from "../../features/todo/TodayObjective";
import { Calendar } from "../../features/calendar/Calendar";
import { AIChat } from "../../features/ai/AIChat";
import { WeeklyRoadmap } from "../../features/roadmap/WeeklyRoadmap";
import { BudgetTracker } from "../../features/budget/BudgetTracker";
import { DiagramStudio } from "../../features/diagrams/DiagramStudio";
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

type RightPanelView =
  | "editor"
  | "todo"
  | "calendar"
  | "budget"
  | "diagrams"
  | "objective"
  | "roadmap"
  | "aichat";

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

export const AppLayout = () => {
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [rightPanelView, setRightPanelView] =
    useState<RightPanelView>("editor");
  const [calendarNudge, setCalendarNudge] = useState(true);
  const [todoCounts, setTodoCounts] = useState<TodoCounts>(emptyTodoCounts);
  const isDragging = useRef(false);
  const activePageId = usePageStore((s) => s.activePageId);
  const {
    state,
    actions,
    isOllamaRunning,
    openPanel,
    closePanel,
    executeAction,
    setSelectedText,
  } = useAgentPanel();

  // Subscribe to raw objectives array to avoid infinite loop from selector returning new array ref
  const objectives = useObjectiveStore((s) => s.objectives);
  const objectiveStats = useMemo(() => {
    const todayKey = todayDateKey();
    const todayObjectives = objectives.filter(
      (obj) => obj.objectiveDate === todayKey,
    );
    return getTodayObjectiveStats(todayObjectives);
  }, [objectives]);

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
    <div className="h-screen w-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex overflow-hidden">
      {/* Left Sidebar - Always Pages */}
      <aside
        style={{ width: sidebarWidth }}
        className="flex-shrink-0 flex flex-col h-full overflow-hidden no-print"
      >
        <Sidebar view={rightPanelView} />
      </aside>

      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className={cn(
          "w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-50 no-print",
          isDragging.current ? "bg-blue-500" : "bg-zinc-200 dark:bg-zinc-800",
        )}
      />

      {/* Right Panel with Tabs */}
      <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden relative">
        {/* Tab Buttons at Top */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 no-print">
          <div className="flex flex-1">
            <button
              onClick={() => setRightPanelView("editor")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
                rightPanelView === "editor"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
              )}
            >
              <FaBookOpen size={14} />
              Pages
            </button>
            <button
              onClick={() => setRightPanelView("todo")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
                rightPanelView === "todo"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
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
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2 relative",
                rightPanelView === "calendar"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
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
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
                rightPanelView === "budget"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
              )}
            >
              <FaWallet size={14} />
              Budget
            </button>
            <button
              onClick={() => setRightPanelView("diagrams")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
                rightPanelView === "diagrams"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
              )}
            >
              <FaProjectDiagram size={14} />
              Diagrams
            </button>
            <button
              onClick={() => setRightPanelView("roadmap")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
                rightPanelView === "roadmap"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
              )}
            >
              <FaMapSigns size={14} />
              Roadmap
            </button>
            <button
              onClick={() => setRightPanelView("objective")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
                rightPanelView === "objective"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
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
              onClick={() => setRightPanelView("aichat")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
                rightPanelView === "aichat"
                  ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900",
              )}
            >
              <FaComments size={14} />
              AI Chat
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

          {/* Notification Bell */}
          <div className="relative px-3">
            <NotificationBell />
            <NotificationInbox />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
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
              {rightPanelView === "aichat" && <AIChat />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating AI Button */}
        {!state.isOpen && (
          <button
            onClick={() => {
              const selectedText =
                window.getSelection()?.toString().trim() || "";
              openPanel(selectedText);
            }}
            className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-2xl hover:shadow-blue-500/50 hover:scale-110 transition-all duration-300 z-50 group no-print"
            title="Open AI Assistant"
          >
            <FaRobot size={24} className="group-hover:animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isOllamaRunning ? "bg-emerald-400" : "bg-amber-400",
                )}
              ></span>
              <span
                className={cn(
                  "relative inline-flex rounded-full h-3 w-3",
                  isOllamaRunning ? "bg-emerald-500" : "bg-amber-500",
                )}
              ></span>
            </span>
          </button>
        )}
      </div>

      {/* AI Agent Panel */}
      <AgentPanel
        state={state}
        actions={actions}
        isOllamaRunning={isOllamaRunning}
        onClose={closePanel}
        onExecuteAction={(action, selectionOverride, pageContext) =>
          executeAction(
            activePageId || "current-page",
            action,
            selectionOverride,
            pageContext,
          )
        }
        onInsertResponse={(response) => {
          // Trigger insertion in editor
          const event = new CustomEvent("insertAIResponse", {
            detail: { response },
          });
          window.dispatchEvent(event);
        }}
        setSelectedText={setSelectedText}
      />
    </div>
  );
};
