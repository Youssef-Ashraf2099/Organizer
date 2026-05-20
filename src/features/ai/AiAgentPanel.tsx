import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAiAgent, type ChatMessage, type PendingChange } from "./useAiAgent";
import { cn } from "../../lib/utils";

// ─── Icons (inline SVG to avoid new deps) ────────────────────────────────────
const IconSend = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const IconBot = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);
const IconUser = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);
const IconCheck = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconUndo = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <path d="M3 7v6h6" />
    <path d="M3 13C5.33 7.67 10.17 4 16 4a9 9 0 0 1 0 18" />
  </svg>
);
const IconX = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconTrash = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);
const IconSparkles = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);

// ─── Typing dots ──────────────────────────────────────────────────────────────
const TypingDots = () => (
  <span className="inline-flex items-center gap-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-blue-400"
        style={{
          animation: `aiDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
  </span>
);

// ─── Message bubble ───────────────────────────────────────────────────────────
const MessageBubble = ({ msg }: { msg: ChatMessage }) => {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("flex gap-2.5 items-start", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gradient-to-br from-violet-600 to-blue-600 text-white",
        )}
      >
        {isUser ? <IconUser /> : <IconBot />}
      </div>

      {/* Content */}
      <div
        className={cn("flex flex-col gap-1 max-w-[85%]", isUser && "items-end")}
      >
        <div
          className={cn(
            "px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-zinc-800/80 text-zinc-100 rounded-tl-sm border border-zinc-700/50",
          )}
        >
          {msg.content || <TypingDots />}
        </div>

        {/* Tool command badges */}
        {msg.toolCommands && msg.toolCommands.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {msg.toolCommands.map((cmd, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium border border-emerald-500/20"
              >
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                {cmd.description ?? cmd.action}
              </span>
            ))}
          </div>
        )}

        <span className="text-[10px] text-zinc-600 px-1">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </motion.div>
  );
};

// ─── Pending Change Card ──────────────────────────────────────────────────────
const PendingChangeCard = ({ change }: { change: PendingChange }) => {
  const { acceptChange, undoChange } = useAiAgent();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/25"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
      <span className="flex-1 text-xs text-emerald-300 truncate">
        {change.description}
      </span>
      <button
        id={`accept-change-${change.id}`}
        onClick={() => acceptChange(change.id)}
        title="Accept change"
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold transition-colors"
      >
        <IconCheck /> Accept
      </button>
      <button
        id={`undo-change-${change.id}`}
        onClick={() => undoChange(change.id)}
        title="Undo change"
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-[10px] font-semibold transition-colors"
      >
        <IconUndo /> Undo
      </button>
    </motion.div>
  );
};

// ─── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Summarize this page",
  "Improve the writing",
  "Add a table of contents",
  "Fix grammar and spelling",
  "Make it more concise",
  "Add action items",
];

// ─── Main Panel ───────────────────────────────────────────────────────────────
export const AiAgentPanel = () => {
  const {
    isOpen,
    messages,
    status,
    errorMessage,
    pendingChanges,
    mode,
    modelState,
    responseStartedAt,
    sendMessage,
    acceptChange,
    undoChange,
    clearMessages,
    dismissError,
    setMode,
    refreshHealth,
    cancelRequest,
  } = useAiAgent();

  const [input, setInput] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Refresh model health when the panel opens
  useEffect(() => {
    if (isOpen) refreshHealth();
  }, [isOpen, refreshHealth]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || status === "thinking" || status === "syncing") return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
    textareaRef.current?.focus();
  };

  const isProcessing = status === "thinking" || status === "syncing";

  useEffect(() => {
    if (!isProcessing || !responseStartedAt) {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - responseStartedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isProcessing, responseStartedAt]);

  const elapsedLabel = isProcessing
    ? ` · ${Math.max(1, Math.round(elapsedMs / 1000))}s`
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="ai-panel"
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="ai-agent-panel flex flex-col h-full w-[360px] flex-shrink-0 border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-xl"
          style={{ boxShadow: "-8px 0 40px rgba(0,0,0,0.4)" }}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg">
              <IconSparkles />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-white">
                Omni AI Agent
              </h2>
              <p className="text-[11px] text-zinc-500 truncate">
                {status === "syncing"
                  ? `📡 Syncing context${elapsedLabel}`
                  : status === "thinking"
                    ? `🧠 Engine thinking${elapsedLabel}`
                    : status === "error"
                      ? "❌ Error"
                      : mode === "agent"
                        ? "🤖 Agent mode"
                        : "💬 Chat mode"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  id="ai-clear-chat"
                  onClick={clearMessages}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <IconTrash />
                </button>
              )}
              {/* Mode toggle */}
              <button
                id="ai-mode-toggle"
                onClick={() => setMode(mode === "chat" ? "agent" : "chat")}
                title={
                  mode === "chat"
                    ? "Switch to Agent mode"
                    : "Switch to Chat mode"
                }
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors border",
                  mode === "agent"
                    ? "bg-violet-600/20 text-violet-300 border-violet-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200",
                )}
              >
                {mode === "agent" ? "🤖 Agent" : "💬 Chat"}
              </button>
            </div>
          </div>

          {/* ── Mode info strip ── */}
          {mode === "agent" && (
            <div className="px-4 py-1.5 border-b border-violet-500/20 bg-violet-950/20 flex-shrink-0">
              <p className="text-[11px] text-violet-300">
                🤖 <strong>Agent mode</strong> — uses LangGraph (Researcher →
                Writer → Reviewer). Best for autonomous tasks.
              </p>
            </div>
          )}

          {/* ── Pending Changes Bar ── */}
          <AnimatePresence>
            {pendingChanges.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-emerald-500/20 bg-emerald-950/20 flex-shrink-0"
              >
                <div className="px-3 py-2 flex flex-col gap-2">
                  <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider px-1">
                    ✦ {pendingChanges.length} Pending{" "}
                    {pendingChanges.length === 1 ? "Change" : "Changes"}
                  </p>
                  <AnimatePresence>
                    {pendingChanges.map((c) => (
                      <PendingChangeCard key={c.id} change={c} />
                    ))}
                  </AnimatePresence>
                  <div className="flex gap-2 mt-1">
                    <button
                      id="ai-accept-all"
                      onClick={() =>
                        pendingChanges.forEach((c) => acceptChange(c.id))
                      }
                      className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      ✓ Accept All
                    </button>
                    <button
                      id="ai-undo-all"
                      onClick={() =>
                        pendingChanges.forEach((c) => undoChange(c.id))
                      }
                      className="flex-1 py-1.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-semibold transition-colors"
                    >
                      ↩ Undo All
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Thinking Progress Bar ── */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-blue-500/20 bg-blue-950/10 flex-shrink-0"
              >
                <div className="px-3 py-2">
                  <div className="ai-progress">
                    <div className="ai-progress-bar" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Model Loading Banner ── */}
          <AnimatePresence>
            {modelState === "loading" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-blue-500/20 bg-blue-950/20 flex-shrink-0"
              >
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="text-blue-300 text-xs">
                    ☕ Warming up the model for faster replies...
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Error Banner ── */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-red-500/20 bg-red-950/30 flex-shrink-0"
              >
                <div className="flex items-start gap-2 px-3 py-2">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <p className="flex-1 text-xs text-red-300">{errorMessage}</p>
                  <button
                    onClick={dismissError}
                    className="text-red-400 hover:text-red-200 transition-colors flex-shrink-0"
                  >
                    <IconX />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Messages Area ── */}
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4 min-h-0 custom-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/30 border border-violet-500/20 flex items-center justify-center">
                  <span className="text-3xl">✨</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Omni AI Agent
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Powered by your local engine at{" "}
                    <code className="text-zinc-400 bg-zinc-800 px-1 rounded">
                      :8000
                    </code>
                    . I can read and edit your page — just ask.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      className="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors border border-zinc-700 hover:border-zinc-600"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-2.5 items-start"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-600 to-blue-600 text-white flex-shrink-0">
                  <IconBot />
                </div>
                <div className="px-3 py-2.5 rounded-2xl rounded-tl-sm bg-zinc-800/80 border border-zinc-700/50">
                  <TypingDots />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area ── */}
          <div className="flex-shrink-0 border-t border-zinc-800 p-3">
            {/* Suggestion chips when there are messages */}
            {messages.length > 0 && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
                {SUGGESTIONS.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] transition-colors border border-zinc-700 hover:border-zinc-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  id="ai-agent-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isProcessing
                      ? "Engine is processing..."
                      : mode === "agent"
                        ? "Describe a task for the agent..."
                        : "Ask the AI agent..."
                  }
                  disabled={isProcessing}
                  rows={1}
                  className={cn(
                    "w-full px-3 py-2.5 pr-2 rounded-xl bg-zinc-800 border text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-all",
                    "focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20",
                    isProcessing
                      ? "border-zinc-700 opacity-60 cursor-not-allowed"
                      : "border-zinc-700",
                  )}
                  style={{ minHeight: 42, maxHeight: 120 }}
                />
              </div>
              <button
                id="ai-send-button"
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                  input.trim() && !isProcessing
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 scale-100 hover:scale-105"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed",
                )}
              >
                {isProcessing ? (
                  <span className="w-4 h-4 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin" />
                ) : (
                  <IconSend />
                )}
              </button>
              {isProcessing && (
                <button
                  id="ai-cancel-button"
                  onClick={cancelRequest}
                  title="Stop request"
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30"
                >
                  <span className="w-3.5 h-3.5 rounded-sm bg-current" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-zinc-700 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
