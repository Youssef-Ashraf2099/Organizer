import { create } from "zustand";

// ─── Runtime detection ────────────────────────────────────────────────────────
const isTauri = () =>
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCommands?: AiToolCommand[];
}

export interface AiToolCommand {
  action: "insert_block" | "replace_all" | "replace_text" | "delete_block";
  params: Record<string, unknown>;
  description?: string;
}

export interface PendingChange {
  id: string;
  description: string;
  toolCommand: AiToolCommand;
  snapshotBefore: unknown[];
  applied: boolean;
}

export type AgentStatus = "idle" | "syncing" | "thinking" | "error";
export type AgentMode = "chat" | "agent";
export type ModelState = "unknown" | "loading" | "ready" | "unavailable";

interface AiAgentState {
  isOpen: boolean;
  messages: ChatMessage[];
  status: AgentStatus;
  errorMessage: string | null;
  pendingChanges: PendingChange[];
  mode: AgentMode;
  modelState: ModelState;
  modelInfo: Record<string, unknown> | null;
  responseStartedAt: number | null;
  cancelRequest: () => void;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setMode: (m: AgentMode) => void;
  sendMessage: (userMessage: string) => Promise<void>;
  acceptChange: (changeId: string) => void;
  undoChange: (changeId: string) => void;
  clearMessages: () => void;
  dismissError: () => void;
  refreshHealth: () => Promise<void>;
}

// ─── Engine base URL ──────────────────────────────────────────────────────────
const ENGINE_PORT = import.meta.env.VITE_AI_PORT || "8000";
const ENGINE_URL = `http://127.0.0.1:${ENGINE_PORT}`;

type HealthResponse = {
  status: string;
  model_loaded?: boolean;
  model_path?: string;
  n_ctx?: number;
  n_threads?: number;
  n_gpu_layers?: number;
  n_batch?: number;
};

let activeAbort: AbortController | null = null;
let activeRequestId: string | null = null;
let canceledRequestId: string | null = null;

// ─── Tauri invoke wrapper ─────────────────────────────────────────────────────
async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ─── Get editor page content via DOM event ────────────────────────────────────
async function getPageContent(): Promise<string> {
  return new Promise((resolve) => {
    (window as any).__currentPageContent = undefined;
    window.dispatchEvent(new CustomEvent("getPageContent"));
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      if ((window as any).__currentPageContent !== undefined || tries > 10) {
        clearInterval(poll);
        resolve((window as any).__currentPageContent ?? "");
      }
    }, 50);
  });
}

// ─── Get editor snapshot for undo ────────────────────────────────────────────
function getSnapshot(): unknown[] {
  return (window as any).__editorSnapshot ?? [];
}

// ─── Dispatch tool command to the editor (DOM event) ─────────────────────────
function dispatchTool(cmd: AiToolCommand) {
  window.dispatchEvent(
    new CustomEvent("aiToolCommand", {
      detail: { action: cmd.action, params: cmd.params },
    })
  );
}

// ─── Sync page content to ChromaDB (best-effort, non-blocking) ───────────────
async function syncContext(pageId: string, content: string): Promise<void> {
  if (!pageId || !content) return;
  try {
    if (isTauri()) {
      await tauriInvoke("sync_page_context", { pageId, content });
    } else {
      await fetch(`${ENGINE_URL}/sync/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, content, type: "markdown" }),
      });
    }
  } catch {
    console.warn("[AI] Context sync skipped — engine may not be running.");
  }
}

// ─── Call /chat/ (multi-turn chat via your engine) ───────────────────────────
async function callChat(
  pageId: string,
  message: string,
  history: ChatMessage[],
  pageContent: string,
  allowTools: boolean,
  signal?: AbortSignal
): Promise<{ response: string; tool_commands: AiToolCommand[] }> {
  if (isTauri()) {
    // Rust ask_ai → POST /chat/ → returns raw JSON string from the engine
    const raw = await tauriInvoke<string>("ask_ai", {
      pageId,
      prompt: message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      pageContent,
      allowTools,
    });
    try {
      const parsed = JSON.parse(raw);
      return {
        response: parsed.response ?? raw,
        tool_commands: parsed.tool_commands ?? [],
      };
    } catch {
      return { response: raw, tool_commands: [] };
    }
  }

  // Browser / dev mode — call FastAPI directly
  const res = await fetch(`${ENGINE_URL}/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      page_id: pageId,
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      page_content: pageContent,
      allow_tools: allowTools,
    }),
  });
  if (!res.ok) throw new Error(`Engine ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Call /agent/ (LangGraph autonomous mode) ─────────────────────────────────
async function callAgent(
  pageId: string,
  task: string
): Promise<{ response: string; tool_commands: AiToolCommand[] }> {
  const extractFromDraft = (draft: string, feedback: string) => {
    if (draft.trim().startsWith("{")) {
      try {
        const cmd = JSON.parse(draft);
        if (cmd.action) return { response: feedback || "Done.", tool_commands: [cmd] };
      } catch { /* not JSON */ }
    }
    return { response: draft, tool_commands: [] as AiToolCommand[] };
  };

  if (isTauri()) {
    const raw = await tauriInvoke<string>("agent_task", { pageId, task });
    try {
      const parsed = JSON.parse(raw);
      return extractFromDraft(parsed.draft ?? "", parsed.feedback ?? "");
    } catch {
      return { response: raw, tool_commands: [] };
    }
  }

  const res = await fetch(`${ENGINE_URL}/agent/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page_id: pageId, task }),
  });
  if (!res.ok) throw new Error(`Agent ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return extractFromDraft(data.draft ?? "", data.feedback ?? "");
}

// ─── Active page ID (read from persisted pageStore) ───────────────────────────
function getActivePageId(): string {
  try {
    const raw = localStorage.getItem("page-store");
    if (!raw) return "default";
    return JSON.parse(raw)?.state?.activePageId ?? "default";
  } catch {
    return "default";
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAiAgent = create<AiAgentState>((set, get) => ({
  isOpen: false,
  messages: [],
  status: "idle",
  errorMessage: null,
  pendingChanges: [],
  mode: "chat",
  modelState: "unknown",
  modelInfo: null,
  responseStartedAt: null,
  cancelRequest: () => {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
    if (activeRequestId) {
      canceledRequestId = activeRequestId;
    }

    set((s) => ({
      status: "idle",
      responseStartedAt: null,
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⏹️ Request canceled.",
          timestamp: Date.now(),
        },
      ],
    }));
  },

  openPanel:    () => set({ isOpen: true }),
  closePanel:   () => set({ isOpen: false }),
  togglePanel:  () => set((s) => ({ isOpen: !s.isOpen })),
  setMode:      (mode) => set({ mode }),
  dismissError: () => set({ errorMessage: null, status: "idle" }),
  clearMessages: () => set({ messages: [], pendingChanges: [] }),
  refreshHealth: async () => {
    set({ modelState: "loading" });
    try {
      const res = await fetch(`${ENGINE_URL}/health`);
      if (!res.ok) throw new Error("health check failed");
      const data: HealthResponse = await res.json();
      set({
        modelState: data.model_loaded ? "ready" : "loading",
        modelInfo: data,
      });
    } catch {
      set({ modelState: "unavailable", modelInfo: null });
    }
  },

  sendMessage: async (userMessage) => {
    const { messages, mode } = get();
    const requestId = crypto.randomUUID();
    activeRequestId = requestId;
    canceledRequestId = null;

    // 1 · append user bubble
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user",
      content: userMessage, timestamp: Date.now(),
    };
    set((s) => ({
      messages: [...s.messages, userMsg],
      status: "syncing",
      responseStartedAt: Date.now(),
    }));

    // 2 · gather context + snapshot
    const pageContent   = await getPageContent();
    const pageId        = getActivePageId();
    const snapshotBefore = getSnapshot();

    // 3 · push page to ChromaDB
    await syncContext(pageId, pageContent);
    set({ status: "thinking" });

    // 4 · call engine
    let response = "";
    let toolCommands: AiToolCommand[] = [];
    try {
      if (mode === "agent") {
        const r = await callAgent(pageId, userMessage);
        response = r.response; toolCommands = r.tool_commands;
      } else {
        activeAbort = new AbortController();
        const r = await callChat(pageId, userMessage, messages, pageContent, false, activeAbort.signal);
        response = r.response; toolCommands = r.tool_commands;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        activeAbort = null;
        return;
      }
      activeAbort = null;
      const msg = err instanceof Error ? err.message : String(err);
      const content =
        `⚠️ Could not reach the AI Engine.\n\n` +
        `**Error:** ${msg}\n\n` +
        `Start your engine:\n\`\`\`\ncd AI-engine\npython -m uvicorn main:app --port 8000\n\`\`\``;
      set((s) => ({
        messages: [...s.messages, {
          id: crypto.randomUUID(), role: "assistant",
          content, timestamp: Date.now(),
        }],
        status: "error",
        errorMessage: msg,
        responseStartedAt: null,
      }));
      return;
    }

    activeAbort = null;

    if (canceledRequestId === requestId) {
      activeRequestId = null;
      return;
    }

    // 5 · append assistant bubble
    if (mode === "chat") {
      toolCommands = [];
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "assistant",
      content: response || "(no response)", timestamp: Date.now(),
      toolCommands: toolCommands.length > 0 ? toolCommands : undefined,
    };
    set((s) => ({ messages: [...s.messages, assistantMsg], status: "idle", responseStartedAt: null }));
    activeRequestId = null;

    // 6 · apply changes + build pending list
    if (mode === "agent" && toolCommands.length > 0) {
      const pending: PendingChange[] = toolCommands.map((cmd) => ({
        id: crypto.randomUUID(),
        description: (cmd.params?.description as string) ?? cmd.description ?? cmd.action,
        toolCommand: cmd,
        snapshotBefore,
        applied: true,
      }));
      pending.forEach((p) => dispatchTool(p.toolCommand));
      set((s) => ({ pendingChanges: [...s.pendingChanges, ...pending] }));
    }

    await get().refreshHealth();
  },

  acceptChange: (changeId) =>
    set((s) => ({ pendingChanges: s.pendingChanges.filter((c) => c.id !== changeId) })),

  undoChange: (changeId) => {
    const change = get().pendingChanges.find((c) => c.id === changeId);
    if (change) {
      window.dispatchEvent(
        new CustomEvent("aiUndoChange", { detail: { snapshot: change.snapshotBefore } })
      );
    }
    set((s) => ({ pendingChanges: s.pendingChanges.filter((c) => c.id !== changeId) }));
  },
}));
