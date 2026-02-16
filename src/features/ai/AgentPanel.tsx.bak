import { useRef, useState, useEffect } from "react";
import { AIAction, AgentPanelState } from "./types";
import { aiService } from "./aiService";
import { extractTextFromPDF } from "./pdfExtractor";
import { FaFilePdf } from "@react-icons/all-files/fa/FaFilePdf";
import { motion, AnimatePresence } from "framer-motion";
import { FaMagic } from "@react-icons/all-files/fa/FaMagic";
import { FaCopy } from "@react-icons/all-files/fa/FaCopy";
import { FaPaperPlane } from "@react-icons/all-files/fa/FaPaperPlane";
import { FaRobot } from "@react-icons/all-files/fa/FaRobot";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaHistory } from "@react-icons/all-files/fa/FaHistory";
import { FaChevronLeft } from "@react-icons/all-files/fa/FaChevronLeft";
import { useChatStore } from "../../core/store/chatStore";
import ReactMarkdown from "react-markdown";

type PanelMode = "agent" | "ask";

interface AgentPanelProps {
  state: AgentPanelState;
  actions: AIAction[];
  isOllamaRunning: boolean;
  onClose: () => void;
  onExecuteAction: (
    actionId: string,
    selectionOverride?: string,
    pageContext?: string,
  ) => Promise<void>;
  onInsertResponse?: (response: string) => void;
  setSelectedText: (text: string) => void;
}

export const AgentPanel = ({
  state,
  actions,
  isOllamaRunning,
  onClose,
  setSelectedText,
}: AgentPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversations = useChatStore((s) => s.conversations);
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const setActiveConv = useChatStore((s) => s.setActiveConversation);
  const addConversation = useChatStore((s) => s.addConversation);
  const addMessage = useChatStore((s) => s.addMessage);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  const [customPrompt, setCustomPrompt] = useState("");
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<PanelMode>("agent");
  const [showHistory, setShowHistory] = useState(false);

  const quickPrompts =
    mode === "agent"
      ? [
          "Summarize this page",
          "Generate a task list",
          "Add a table of contents",
          "Fix grammar & spelling",
        ]
      : [
          "Explain the main idea",
          "What is this about?",
          "Suggest improvements",
          "How can I organize this?",
        ];

  // Initialize active conversation if needed
  useEffect(() => {
    if (state.isOpen && !activeConvId) {
      if (conversations.length > 0) {
        setActiveConv(conversations[0].id);
      } else {
        addConversation();
      }
    }
  }, [
    state.isOpen,
    activeConvId,
    conversations,
    setActiveConv,
    addConversation,
  ]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Scroll to bottom
  useEffect(() => {
    if (state.isOpen && !showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConv?.messages, state.isOpen, showHistory]);

  // Handle Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showHistory) setShowHistory(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showHistory]);

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await extractTextFromPDF(file);
      setPdfText(text);
      setPdfFileName(file.name);
      setSelectedText(`📄 PDF: ${file.name}\n(${text.length} chars loaded)`);
    } catch {
      alert("Failed to process PDF");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleNewSession = () => {
    addConversation();
    setShowHistory(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveConv(id);
    setShowHistory(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  /* ------------------------------------------------------------------ */
  /*  SEND MESSAGE                                                       */
  /* ------------------------------------------------------------------ */
  const handleSendMessage = async (text: string = customPrompt) => {
    if (!text.trim()) return;
    if (!activeConvId) {
      addConversation();
      return;
    }

    // Gather page context (only in Agent mode)
    let pageContent = "";
    if (mode === "agent") {
      try {
        window.dispatchEvent(new CustomEvent("getPageContent"));
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 50));
          const c = (window as any).__currentPageContent;
          if (c) {
            pageContent = c;
            delete (window as any).__currentPageContent;
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }

    let contextBlock = "";
    if (pageContent)
      contextBlock += `\n\nCURRENT PAGE CONTENT:\n${pageContent.slice(0, 15000)}`;
    if (state.selectedText)
      contextBlock += `\n\nSELECTED TEXT:\n${state.selectedText}`;
    if (pdfText) contextBlock += `\n\nPDF CONTEXT:\n${pdfText.slice(0, 5000)}`;

    setIsLoading(true);
    setCustomPrompt("");

    // Show user message in UI (without context cruft)
    addMessage(activeConvId, {
      role: "user",
      content:
        text +
        (state.selectedText
          ? `\n\n[Context: ${state.selectedText.slice(0, 200)}...]`
          : ""),
    });

    try {
      const aiState = await aiService.getState();

      // Build message array — tool defs go as SYSTEM, never in user content
      const historyMsgs = activeConv
        ? activeConv.messages.map((m) => ({ role: m.role, content: m.content }))
        : [];

      const messages: { role: string; content: string }[] = [];

      if (mode === "agent") {
        // System message with tool definitions
        messages.push({
          role: "system",
          content: aiService.getToolDefinitions(),
        });
      } else {
        // Ask mode — simple helpful assistant, no tools
        messages.push({
          role: "system",
          content:
            "You are a helpful AI assistant. Answer the user's questions clearly and concisely. Do NOT output any JSON tool blocks.",
        });
      }

      // Conversation history
      messages.push(...historyMsgs);

      // Current user message + context
      messages.push({
        role: "user",
        content: text + contextBlock,
      });

      const response = await aiService.chat(
        messages,
        aiState.model,
        aiState.backend,
      );

      // --- Hallucination guard ---
      if (aiService.isHallucination(response)) {
        addMessage(activeConvId, {
          role: "assistant",
          content:
            "I had trouble generating that. Please try rephrasing your request.",
        });
        return;
      }

      if (mode === "ask") {
        // Ask mode — never touch the page
        addMessage(activeConvId, {
          role: "assistant",
          content: response || "No response",
        });
        return;
      }

      // Agent mode — parse for tool commands
      const parsed = aiService.extractJsonFromResponse(response);
      const commands = parsed?.commands ?? [];
      const textResponse = parsed?.textResponse ?? "";

      // Dispatch tool commands to the editor
      if (commands.length > 0) {
        for (const command of commands) {
          window.dispatchEvent(
            new CustomEvent("aiToolCommand", { detail: command }),
          );
        }
      }

      // Agent mode fallback: if the AI returned text content without a tool
      // block, and the user asked for content (not a question), auto-insert it
      // into the page so it doesn't just sit in the chat.
      const isQuestion =
        /^(what|who|why|how|when|where|which|is |are |can |do |does |did |will |would |should |could |has |have |explain|tell me about)\b/i.test(
          text.trim(),
        );

      if (commands.length === 0 && textResponse && !isQuestion) {
        // The AI forgot to use a tool — send the text to the page anyway
        window.dispatchEvent(
          new CustomEvent("aiToolCommand", {
            detail: {
              action: "append_text",
              params: { content: textResponse },
            },
          }),
        );
        addMessage(activeConvId, {
          role: "assistant",
          content: "✅ Content added to the page.",
        });
      } else if (commands.length > 0 && textResponse) {
        addMessage(activeConvId, {
          role: "assistant",
          content: textResponse + "\n\n✅ Changes applied to the page.",
        });
      } else if (commands.length > 0) {
        addMessage(activeConvId, {
          role: "assistant",
          content: "✅ I've updated the page for you.",
        });
      } else {
        // Pure chat response (user asked a question)
        addMessage(activeConvId, {
          role: "assistant",
          content: textResponse || response || "No response",
        });
      }
    } catch (e) {
      console.error(e);
      addMessage(activeConvId, {
        role: "assistant",
        content: "Error: Failed to generate response.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  RENDER                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <AnimatePresence>
      {state.isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none p-4 pt-20">
          <div className="absolute inset-0 pointer-events-none" />

          <motion.div
            layoutId="agent-panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            ref={panelRef}
            className="pointer-events-auto w-full max-w-[400px] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl flex flex-col h-[calc(100vh-6rem)] text-zinc-100 font-sans relative"
          >
            {/* ===== Header ===== */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                  <FaRobot className="text-white text-xs" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    AI Assistant
                  </h3>
                  <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isOllamaRunning ? "bg-emerald-400" : "bg-red-500"}`}
                    />
                    {isOllamaRunning ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* New Session */}
                <button
                  onClick={handleNewSession}
                  className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition"
                  title="New session"
                >
                  <FaPlus size={12} />
                </button>
                {/* History */}
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2 rounded-lg transition ${showHistory ? "bg-white/10 text-white" : "hover:bg-white/10 text-zinc-400 hover:text-white"}`}
                  title="Session history"
                >
                  <FaHistory size={12} />
                </button>
                {/* Close */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition"
                >
                  ×
                </button>
              </div>
            </div>

            {/* ===== Agent / Ask Mode Toggle ===== */}
            <div className="flex gap-1 px-4 py-2 border-b border-white/5 bg-zinc-900/40">
              <button
                onClick={() => setMode("agent")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                  mode === "agent"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                ⚡ Agent
              </button>
              <button
                onClick={() => setMode("ask")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                  mode === "ask"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                💬 Ask
              </button>
              <div className="flex items-center ml-2">
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full border ${
                    mode === "agent"
                      ? "text-blue-400 border-blue-500/30 bg-blue-500/10"
                      : "text-purple-400 border-purple-500/30 bg-purple-500/10"
                  }`}
                >
                  {mode === "agent" ? "Edits page" : "Chat only"}
                </span>
              </div>
            </div>

            {/* ===== History Panel ===== */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-b border-white/5 overflow-hidden"
                >
                  <div className="p-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-zinc-400">
                        Sessions ({conversations.length})
                      </span>
                      <button
                        onClick={() => setShowHistory(false)}
                        className="text-zinc-500 hover:text-white text-xs"
                      >
                        <FaChevronLeft size={10} />
                      </button>
                    </div>
                    {conversations.length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-4">
                        No sessions yet
                      </p>
                    )}
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectSession(conv.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-xs transition group flex items-center justify-between ${
                          conv.id === activeConvId
                            ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                            : "hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {conv.title}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {conv.messages.length} messages •{" "}
                            {new Date(conv.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition ml-2 flex-shrink-0"
                          title="Delete session"
                        >
                          <FaTrash size={10} />
                        </button>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ===== Chat Area ===== */}
            <div className="flex-1 overflow-y-scroll p-4 space-y-4 scroll-smooth custom-scrollbar min-h-0">
              {activeConv?.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
                  <FaMagic className="text-4xl text-zinc-700" />
                  <p className="text-sm text-zinc-300">
                    {mode === "agent"
                      ? "I can edit your page. Try asking me to write something!"
                      : "Ask me anything — I'll answer without editing the page."}
                  </p>

                  {/* Quick Actions Grid */}
                  {actions.length > 0 && mode === "agent" && (
                    <div className="grid grid-cols-2 gap-2 w-full mt-4">
                      {actions.slice(0, 4).map((action) => (
                        <button
                          key={action.id}
                          onClick={() =>
                            handleSendMessage(
                              action.system_prompt || action.name,
                            )
                          }
                          className="p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-xl text-left transition text-xs group"
                        >
                          <div className="font-medium text-zinc-300 group-hover:text-blue-200 mb-1">
                            {action.name}
                          </div>
                          <div className="text-zinc-500 truncate">
                            {action.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeConv?.messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded bg-indigo-600/50 flex items-center justify-center flex-shrink-0 mt-1">
                      <FaRobot size={12} />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-zinc-800 text-zinc-200 rounded-tl-sm border border-white/5"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(msg.content)
                        }
                        className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                      >
                        <FaCopy size={10} /> Copy
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-6 h-6 rounded bg-indigo-600/50 flex items-center justify-center flex-shrink-0 mt-1">
                    <FaRobot size={12} />
                  </div>
                  <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ===== Input Area ===== */}
            <div className="p-3 bg-zinc-900 border-t border-white/5">
              {/* Context Pills */}
              {(state.selectedText || pdfFileName) && (
                <div className="flex gap-2 mb-2 px-1">
                  {state.selectedText && (
                    <div className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20 truncate max-w-[150px]">
                      From selection
                    </div>
                  )}
                  {pdfFileName && (
                    <div className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-1 rounded border border-orange-500/20 flex items-center gap-1">
                      <FaFilePdf size={10} /> {pdfFileName}
                      <button
                        onClick={() => {
                          setPdfText("");
                          setPdfFileName("");
                        }}
                        className="ml-1 hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={
                    mode === "agent"
                      ? "Tell me to edit the page..."
                      : "Ask me anything..."
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-sm text-zinc-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none max-h-32 min-h-[48px]"
                  rows={1}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition"
                    title="Attach PDF"
                  >
                    <FaFilePdf size={14} />
                  </button>
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!customPrompt.trim() || isLoading}
                    className={`p-1.5 rounded-lg transition ${customPrompt.trim() ? "bg-blue-600 text-white shadow-lg" : "bg-zinc-800 text-zinc-600"}`}
                  >
                    <FaPaperPlane size={12} />
                  </button>
                </div>
              </div>

              {/* Quick Prompts */}
              <div className="mt-2 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setCustomPrompt(prompt);
                      inputRef.current?.focus();
                    }}
                    className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 hover:bg-white/5 transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePDFUpload}
                className="hidden"
              />

              <div className="text-center mt-2 text-[10px] text-zinc-600">
                Enter to send • Shift+Enter new line •{" "}
                <span
                  className={
                    mode === "agent" ? "text-blue-500" : "text-purple-500"
                  }
                >
                  {mode === "agent" ? "Agent" : "Ask"} mode
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
