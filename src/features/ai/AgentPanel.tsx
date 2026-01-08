import { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { AIAction, AgentPanelState, BackendType } from "./types";
import { aiService } from "./aiService";
import { extractTextFromPDF } from "./pdfExtractor";
import { FaFilePdf } from "@react-icons/all-files/fa/FaFilePdf";

interface AgentPanelProps {
  state: AgentPanelState;
  actions: AIAction[];
  isOllamaRunning: boolean;
  onClose: () => void;
  onExecuteAction: (
    actionId: string,
    selectionOverride?: string,
    pageContext?: string
  ) => Promise<void>;
  onInsertResponse?: (response: string) => void;
  setSelectedText: (text: string) => void;
}

export const AgentPanel = ({
  state,
  actions,
  isOllamaRunning,
  onClose,
  onExecuteAction,
  onInsertResponse,
  setSelectedText,
}: AgentPanelProps) => {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingPDF, setIsLoadingPDF] = useState(false);
  const [backend, setBackend] = useState<BackendType>("Ollama");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434");
  const [model, setModel] = useState("llama3.2:3b");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [autoInsert, setAutoInsert] = useState(true);

  // Auto-insert responses into the page when enabled
  useEffect(() => {
    if (autoInsert && state.response && !state.isLoading) {
      console.debug("AI auto-insert firing", {
        responseLength: state.response.length,
        selectedAction: state.selectedAction,
      });
      onInsertResponse?.(state.response);
    }
  }, [autoInsert, state.response, state.isLoading, onInsertResponse]);

  // Handle PDF file upload
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingPDF(true);
    try {
      const text = await extractTextFromPDF(file);
      // Update selected text for visibility
      setSelectedText(text.slice(0, 5000));
      const summarizeAction = actions.find((a) => a.id === "summarize");
      if (summarizeAction) {
        await onExecuteAction(
          "summarize",
          text.slice(0, 5000),
          text.slice(0, 5000)
        );
      }
    } catch (error) {
      alert(
        `Failed to process PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoadingPDF(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Load config and models
  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await aiService.getState();
        setBackend(cfg.backend);
        setBaseUrl(cfg.base_url);
        setModel(cfg.model);
        const models = await aiService.listModels();
        setAvailableModels(models);
      } catch (e) {
        // ignore for now
      }
    };
    load();
  }, []);

  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center px-3 py-4 pointer-events-auto">
      <div
        ref={panelRef}
        className="w-full max-w-4xl h-[76vh] max-h-[760px] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
      >
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 opacity-90" />
          <div className="relative flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-white/80 font-semibold">
                AI Assistant
              </p>
              <h2 className="text-xl font-bold text-white">
                Work faster with context
              </h2>
              <div className="flex items-center gap-3 text-xs text-white/80">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-full",
                    isOllamaRunning
                      ? "bg-white/20"
                      : "bg-yellow-400/30 text-amber-50"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isOllamaRunning ? "bg-emerald-300" : "bg-amber-300"
                    )}
                  />
                  {isOllamaRunning ? "Backend connected" : "Connecting..."}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-white/90">
                  Model: {model}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/90 hover:text-white hover:bg-white/20 transition-colors p-2 rounded-full"
              aria-label="Close AI panel"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-gradient-to-b from-white/60 via-white/40 to-white/60 dark:from-zinc-950/40 dark:via-zinc-950/10 dark:to-zinc-950/40">
          {/* Status / Selected Text */}
          <div className="px-5 py-4 border-b border-white/50 dark:border-white/5 bg-white/70 dark:bg-zinc-950/50">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Selected text
            </p>
            <div className="text-sm text-zinc-900 dark:text-zinc-50 line-clamp-2 italic">
              {state.selectedText || "No text selected"}
            </div>
          </div>

          {/* Settings + Prompt */}
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/60 shadow-sm">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                  Backend
                </label>
                <select
                  value={backend}
                  onChange={(e) => setBackend(e.target.value as BackendType)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-sm"
                >
                  <option value="Ollama">Ollama</option>
                  <option value="OpenAI">LM Studio/GPT4All</option>
                </select>
              </div>

              <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/60 shadow-sm">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                  Base URL
                </label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-sm"
                  placeholder={
                    backend === "Ollama" ? "localhost:11434" : "localhost:1234"
                  }
                />
              </div>

              <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/60 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    Model
                  </label>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Quick save
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-sm"
                  >
                    {[model, ...availableModels.filter((m) => m !== model)].map(
                      (m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      )
                    )}
                  </select>
                  <button
                    onClick={async () => {
                      try {
                        await aiService.setState(backend, baseUrl, model);
                        const models = await aiService.listModels();
                        setAvailableModels(models);
                      } catch (e) {
                        console.error("Failed to save config:", e);
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/90 dark:bg-zinc-900/70 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Custom Prompt
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">
                    Ask anything or give instructions
                  </p>
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {customPrompt.length}/4000
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={autoInsert}
                  onChange={(e) => setAutoInsert(e.target.checked)}
                  className="accent-emerald-600"
                />
                Auto-insert responses into the page
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                className="w-full px-3 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-sm shadow-inner"
                placeholder="Summarize meeting notes, draft an email, generate ideas..."
              />
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => setCustomPrompt("")}
                  className="px-3 py-2 text-sm rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                >
                  Clear
                </button>
                <button
                  disabled={!customPrompt.trim()}
                  onClick={() =>
                    onExecuteAction(
                      "custom_prompt",
                      // Treat the user's prompt as the main query
                      customPrompt,
                      // Use selected text (or prompt) as context if nothing is selected
                      state.selectedText || customPrompt
                    )
                  }
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Run Prompt
                </button>
              </div>
            </div>

            {/* PDF Upload Section */}
            <div className="p-4 rounded-2xl border border-purple-200/70 dark:border-purple-500/30 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePDFUpload}
                className="hidden"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <p className="font-semibold">Upload & Summarize PDF</p>
                  <p className="text-white/80 text-xs">
                    We will auto-run summarize on the extracted text
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingPDF}
                  className="px-4 py-2.5 bg-white text-purple-700 font-semibold rounded-xl hover:bg-white/90 disabled:opacity-60 transition flex items-center gap-2"
                >
                  <FaFilePdf size={16} />
                  {isLoadingPDF ? "Processing..." : "Choose PDF"}
                </button>
              </div>
            </div>
          </div>

          {/* Actions Grid */}
          {!state.response && !state.isLoading && (
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Quick Actions
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Pick a preset or use your prompt above
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => onExecuteAction(action.id)}
                    disabled={!isOllamaRunning}
                    onMouseEnter={() => setHoveredAction(action.id)}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                      "p-3 rounded-xl text-left transition-all group relative border shadow-sm",
                      isOllamaRunning
                        ? "bg-white/90 dark:bg-zinc-900/70 border-zinc-200 dark:border-white/10 hover:border-blue-400/80 dark:hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5"
                        : "bg-zinc-100 dark:bg-zinc-800 opacity-40 cursor-not-allowed border-zinc-300 dark:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                        {action.name}
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-blue-500 dark:text-blue-300">
                        Preset
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {action.description}
                    </div>

                    {/* Tooltip */}
                    {hoveredAction === action.id && isOllamaRunning && (
                      <div className="absolute -top-9 left-0 bg-zinc-900/95 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                        {action.system_prompt}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {state.isLoading && (
            <div className="flex-1 flex items-center justify-center px-5 pb-6">
              <div className="text-center bg-white/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 rounded-xl px-6 py-5 shadow-sm">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3" />
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Generating response...
                </p>
              </div>
            </div>
          )}

          {/* Response Display */}
          {state.response && !state.isLoading && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white/80 dark:bg-zinc-900/70 border-t border-zinc-200 dark:border-white/10">
              <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 dark:from-emerald-500/15 dark:to-blue-500/15 border-b border-emerald-200/40 dark:border-emerald-500/30">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {actions.find((a) => a.id === state.selectedAction)?.name ||
                    "Response"}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <div className="text-sm text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">
                  {state.response}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {state.error && (
            <div className="flex-1 flex items-center justify-center px-5 pb-6">
              <div className="text-center p-4 rounded-xl border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-sm text-red-700 dark:text-red-200">
                  {state.error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {state.response && !state.isLoading && (
          <div className="p-4 border-t border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row gap-2 bg-white/90 dark:bg-zinc-950/80 backdrop-blur-lg">
            <button
              onClick={() => {
                onInsertResponse?.(state.response);
                onClose();
              }}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Insert Response
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(state.response);
              }}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
