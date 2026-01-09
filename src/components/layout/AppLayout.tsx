import { useState, useRef, useCallback, useEffect } from "react";
import { Sidebar } from "../../features/sidebar/Sidebar";
import { OmniEditor } from "../../features/editor/OmniEditor";
import { AgentPanel } from "../../features/ai/AgentPanel";
import { useAgentPanel } from "../../features/ai/useAgentPanel";
import { cn } from "../../lib/utils";
import { usePageStore } from "../../core/store/pageStore";
import { FaRobot } from "@react-icons/all-files/fa/FaRobot";
import { FaListUl } from "@react-icons/all-files/fa/FaListUl";
import { FaCalendar } from "@react-icons/all-files/fa/FaCalendar";
import { FaFile } from "@react-icons/all-files/fa/FaFile";
import { TodoList } from "../../features/todo/TodoList";
import { Calendar } from "../../features/calendar/Calendar";

type RightPanelView = "editor" | "todo" | "calendar";

export const AppLayout = () => {
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [rightPanelView, setRightPanelView] =
    useState<RightPanelView>("editor");
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
      <div
        style={{ width: sidebarWidth }}
        className="flex-shrink-0 flex flex-col h-full overflow-hidden"
      >
        <Sidebar />
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className={cn(
          "w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-50",
          isDragging.current ? "bg-blue-500" : "bg-zinc-200 dark:bg-zinc-800"
        )}
      />

      {/* Right Panel with Tabs */}
      <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden relative">
        {/* Tab Buttons at Top */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
          <button
            onClick={() => setRightPanelView("editor")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
              rightPanelView === "editor"
                ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            )}
          >
            <FaFile size={14} />
            Pages
          </button>
          <button
            onClick={() => setRightPanelView("todo")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
              rightPanelView === "todo"
                ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            )}
          >
            <FaListUl size={14} />
            To-Do
          </button>
          <button
            onClick={() => setRightPanelView("calendar")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition flex items-center gap-2",
              rightPanelView === "calendar"
                ? "bg-zinc-50 dark:bg-zinc-950 text-blue-600 border-b-2 border-blue-600"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            )}
          >
            <FaCalendar size={14} />
            Calendar
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {rightPanelView === "editor" && (
            <OmniEditor onSelectText={() => {}} />
          )}
          {rightPanelView === "todo" && <TodoList />}
          {rightPanelView === "calendar" && <Calendar />}
        </div>

        {/* Floating AI Button */}
        {!state.isOpen && (
          <button
            onClick={() => {
              const selectedText =
                window.getSelection()?.toString().trim() || "";
              openPanel(selectedText);
            }}
            className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-2xl hover:shadow-blue-500/50 hover:scale-110 transition-all duration-300 z-50 group"
            title="Open AI Assistant"
          >
            <FaRobot size={24} className="group-hover:animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isOllamaRunning ? "bg-emerald-400" : "bg-amber-400"
                )}
              ></span>
              <span
                className={cn(
                  "relative inline-flex rounded-full h-3 w-3",
                  isOllamaRunning ? "bg-emerald-500" : "bg-amber-500"
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
            pageContext
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
