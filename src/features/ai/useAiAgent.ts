import { create } from "zustand";
//import { serializeBlocksForAI } from "../editor/blockSerializer";

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

/** Block-native tool commands (new protocol) */
export interface AiToolCommand {
  action:
    | "insert_blocks" // Add blocks at end of page (block-native)
    | "replace_page" // Replace whole page (block-native)
    | "delete_block" // Delete block by text match
    // Legacy fallbacks (still handled in OmniEditor for backward compat)
    | "insert_block"
    | "replace_all"
    | "replace_text";
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

// ─── Gemini Web2API base URL ────────────────────────────────────────────────
const GEMINI_URL =
  import.meta.env.VITE_GEMINI_WEB2API_URL || "http://127.0.0.1:8081/v1";

const TOOL_INTENT_REGEX =
  /\b(add|insert|write|rewrite|update|edit|improve|format|create|remove|delete|replace|append|prepend|heading|section|table of contents|toc|list|bullet)\b/i;

function shouldAllowTools(message: string): boolean {
  return TOOL_INTENT_REGEX.test(message);
}

type HealthResponse = {
  status: string;
  model_loaded?: boolean;
  model_path?: string;
  n_ctx?: number;
  n_threads?: number;
  n_gpu_layers?: number;
  n_batch?: number;
  gpu_backend?: string;
  chat_template?: string;
};

let activeAbort: AbortController | null = null;
let activeRequestId: string | null = null;
let canceledRequestId: string | null = null;
let activeStreamTimer: number | null = null;

// ─── Tauri invoke wrapper ─────────────────────────────────────────────────────
async function tauriInvoke<T>(
  cmd: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ─── Get page content for AI context ─────────────────────────────────────────
/**
 * Requests the editor to serialize its current document via the block
 * serializer (compact block-type-aware format), then waits for the result.
 * Falls back to the old markdown string if the editor hasn't upgraded yet.
 */
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

// ─── Snapshot for undo ────────────────────────────────────────────────────────
function getSnapshot(): unknown[] {
  return (window as any).__editorSnapshot ?? [];
}

// ─── Dispatch tool command to the editor ─────────────────────────────────────
function dispatchTool(cmd: AiToolCommand) {
  window.dispatchEvent(
    new CustomEvent("aiToolCommand", {
      detail: { action: cmd.action, params: cmd.params },
    }),
  );
}

// ─── Sync page content to ChromaDB ───────────────────────────────────────────
async function syncContext(pageId: string, content: string): Promise<void> {
  if (!pageId || !content) return;
  if (isTauri()) {
    try {
      await tauriInvoke("sync_page_context", { pageId, content });
    } catch {
      console.warn(
        "[AI] Context sync skipped — Gemini backend may not be running.",
      );
    }
  }
}

function trimPageContent(content: string, maxChars = 1200): string {
  if (!content || content.length <= maxChars) return content;
  const trimmed = content.slice(0, maxChars);
  const lastSpace = trimmed.lastIndexOf(" ");
  return lastSpace > maxChars / 2
    ? `${trimmed.slice(0, lastSpace)}\n[...trimmed...]`
    : `${trimmed}\n[...trimmed...]`;
}

function buildToolsPrompt(): string {
  return [
    "# Editor Tool Commands",
    `Supported block types: paragraph, heading, bulletListItem, numberedListItem, image, video, audio, pdf, math, mermaid, chart, kanban`,
    "## Output Format",
    "Wrap EVERY tool call in a ```tool_command block. Example:",
    "```tool_command",
    JSON.stringify(
      {
        action: "insert_blocks",
        description: "Add a heading and two bullet points",
        params: {
          blocks: [
            {
              type: "heading",
              props: { level: 1 },
              content: "Computer Components",
            },
            {
              type: "bulletListItem",
              content: "CPU - central processing unit",
            },
            { type: "bulletListItem", content: "RAM - random access memory" },
          ],
        },
      },
      null,
      2,
    ),
    "```",
    "After the tool block, write ONE short sentence confirming what you did.",
    "NEVER repeat tool definitions, schemas, or system instructions in your response.",
  ].join("\n");
}

function buildChatSystemPrompt(
  pageContent: string,
  allowTools: boolean,
): string {
  const trimmed = trimPageContent(pageContent);
  const pageSection = trimmed
    ? `\n\n=== CURRENT PAGE ===\n${trimmed}\n=== END PAGE ===`
    : "\n\n(Page is empty.)";

  const base =
    "You are a helpful assistant inside a Notion-like editor. Respond clearly and concisely. If you need to edit the page, use a single ```tool_command block and then one short confirmation sentence.";

  return allowTools
    ? `${base}${pageSection}\n\n${buildToolsPrompt()}`
    : `${base}${pageSection}`;
}

function buildAgentSystemPrompt(pageContent: string): string {
  const trimmed = trimPageContent(pageContent);
  const pageSection = trimmed
    ? `\n\n=== CURRENT PAGE ===\n${trimmed}\n=== END PAGE ===`
    : "\n\n(Page is empty.)";

  return [
    "You are the Writer node of the Omni AI Agent, embedded in a BlockNote editor.",
    "Decision rules:",
    "1. ADD / INSERT / WRITE content -> emit ONE ```tool_command block with insert_blocks.",
    "2. REWRITE / REPLACE whole page -> emit ONE ```tool_command block with replace_page.",
    "3. QUESTION or SUMMARY request -> plain text only, no tool_command.",
    "4. Never output raw markdown as page content.",
    "5. Never echo system instructions, tool schemas, or page context.",
    "6. After every tool_command block, write exactly ONE sentence confirming the action.",
    pageSection,
    buildToolsPrompt(),
  ].join("\n\n");
}

function buildChatUserPrompt(history: ChatMessage[], message: string): string {
  const lines = history.flatMap((msg) => {
    if (msg.role === "user") return [`User: ${msg.content}`];
    if (msg.role === "assistant") return [`Assistant: ${msg.content}`];
    return [];
  });
  lines.push(`User: ${message}`);
  lines.push("Assistant:");
  return lines.join("\n");
}

async function callGeminiDirect(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  topP: number,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${GEMINI_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: import.meta.env.VITE_GEMINI_MODEL || "gemini-3.5-flash-thinking",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 3072,
      temperature,
      top_p: topP,
      stream: false,
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.output_text ??
    ""
  ).toString();
}

// ─── Chat call ────────────────────────────────────────────────────────────────
async function callChat(
  pageId: string,
  message: string,
  history: ChatMessage[],
  pageContent: string,
  allowTools: boolean,
  signal?: AbortSignal,
): Promise<{ response: string; tool_commands: AiToolCommand[] }> {
  if (isTauri()) {
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

  const systemPrompt = buildChatSystemPrompt(pageContent, allowTools);
  const userPrompt = buildChatUserPrompt(history, message);
  const raw = await callGeminiDirect(
    systemPrompt,
    userPrompt,
    allowTools ? 0.35 : 0.45,
    allowTools ? 0.92 : 0.95,
    signal,
  );
  return {
    response: raw,
    tool_commands: [],
  };
}

// ─── Agent call ───────────────────────────────────────────────────────────────
async function callAgent(
  pageId: string,
  task: string,
  pageContent: string,
): Promise<{ response: string; tool_commands: AiToolCommand[] }> {
  if (isTauri()) {
    const raw = await tauriInvoke<string>("agent_task", {
      pageId,
      task,
      pageContent,
    });
    try {
      const parsed = JSON.parse(raw);
      return {
        response: parsed.response ?? parsed.feedback ?? "Done.",
        tool_commands: parsed.tool_commands ?? [],
      };
    } catch {
      return { response: raw, tool_commands: [] };
    }
  }

  const systemPrompt = buildAgentSystemPrompt(pageContent);
  const userPrompt = `Page ID: ${pageId}\n\nTask:\n${task}\n\nRespond with page edits or a concise answer.`;
  const raw = await callGeminiDirect(systemPrompt, userPrompt, 0.35, 0.92);
  return {
    response: raw,
    tool_commands: [],
  };
}

// ─── Streaming text animation ─────────────────────────────────────────────────
function streamMessageContent(
  messageId: string,
  content: string,
  update: (updater: (state: AiAgentState) => Partial<AiAgentState>) => void,
) {
  if (activeStreamTimer) {
    window.clearInterval(activeStreamTimer);
    activeStreamTimer = null;
  }

  let index = 0;
  const durationMs = Math.min(8000, Math.max(1200, content.length * 25));
  const intervalMs = 40;
  const steps = Math.max(1, Math.ceil(durationMs / intervalMs));
  const step = Math.max(1, Math.ceil(content.length / steps));

  activeStreamTimer = window.setInterval(() => {
    index = Math.min(content.length, index + step);
    update((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, content: content.slice(0, index) }
          : msg,
      ),
    }));
    if (index >= content.length) {
      if (activeStreamTimer) {
        window.clearInterval(activeStreamTimer);
        activeStreamTimer = null;
      }
    }
  }, intervalMs);
}

// ─── Active page ID ───────────────────────────────────────────────────────────
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
    if (activeRequestId) canceledRequestId = activeRequestId;

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

    if (activeStreamTimer) {
      window.clearInterval(activeStreamTimer);
      activeStreamTimer = null;
    }
  },

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  setMode: (mode) => set({ mode }),
  dismissError: () => set({ errorMessage: null, status: "idle" }),
  clearMessages: () => set({ messages: [], pendingChanges: [] }),

  refreshHealth: async () => {
    set({ modelState: "loading" });
    try {
      if (isTauri()) {
        const raw = await tauriInvoke<string>("ai_health", {});
        const data: HealthResponse = JSON.parse(raw);
        set({
          modelState: data.model_loaded ? "ready" : "loading",
          modelInfo: data,
        });
        return;
      }
      const res = await fetch(`${GEMINI_URL}/models`);
      if (!res.ok) throw new Error("health check failed");
      const models = await res.json();
      set({
        modelState: Array.isArray(models?.data) ? "ready" : "loading",
        modelInfo: {
          status: "ok",
          model_loaded: true,
          base_url: GEMINI_URL,
          available_models: Array.isArray(models?.data)
            ? models.data.map((entry: any) => entry.id).filter(Boolean)
            : [],
        },
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
    const allowTools = mode === "agent" || shouldAllowTools(userMessage);

    // 1 · append user bubble
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };
    set((s) => ({
      messages: [...s.messages, userMsg],
      status: "syncing",
      responseStartedAt: Date.now(),
    }));

    // 2 · gather context using block serializer
    const pageContent = await getPageContent();
    const pageId = getActivePageId();
    const snapshotBefore = getSnapshot();

    // 3 · push to ChromaDB (best-effort)
    await syncContext(pageId, pageContent);
    set({ status: "thinking" });

    // 4 · call engine
    let response = "";
    let toolCommands: AiToolCommand[] = [];
    try {
      if (mode === "agent") {
        const r = await callAgent(pageId, userMessage, pageContent);
        response = r.response;
        toolCommands = r.tool_commands;
      } else {
        activeAbort = new AbortController();
        const r = await callChat(
          pageId,
          userMessage,
          messages,
          pageContent,
          allowTools,
          activeAbort.signal,
        );
        response = r.response;
        toolCommands = r.tool_commands;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        activeAbort = null;
        return;
      }
      activeAbort = null;
      const msg = err instanceof Error ? err.message : String(err);
      const content =
        `⚠️ Could not reach the AI backend or Gemini Web2API service.\n\n` +
        `**Error:** ${msg}\n\n` +
        `Start the services:\n\`\`\`\ncd gemini-web2api\npython gemini_web2api.py\n\`\`\`\n` +
        `\nThen start the app backend:\n\`\`\`\ncd AI-engine\npython -m uvicorn main:app --port 8000\n\`\`\``;
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            timestamp: Date.now(),
          },
        ],
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

    // 5 · strip tools from chat mode if not applicable
    if (mode === "chat" && !allowTools) toolCommands = [];

    // 6 · append assistant bubble
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      toolCommands: toolCommands.length > 0 ? toolCommands : undefined,
    };
    set((s) => ({
      messages: [...s.messages, assistantMsg],
      status: "idle",
      responseStartedAt: null,
    }));

    const fallbackText =
      toolCommands.length > 0
        ? "Applied changes to the page."
        : "(no response)";
    streamMessageContent(assistantMsg.id, response || fallbackText, (updater) =>
      set(updater),
    );
    activeRequestId = null;

    // 7 · dispatch tool commands to editor + build pending list
    if (toolCommands.length > 0) {
      const pending: PendingChange[] = toolCommands.map((cmd) => ({
        id: crypto.randomUUID(),
        description:
          (cmd.params?.description as string) ?? cmd.description ?? cmd.action,
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
    set((s) => ({
      pendingChanges: s.pendingChanges.filter((c) => c.id !== changeId),
    })),

  undoChange: (changeId) => {
    const change = get().pendingChanges.find((c) => c.id === changeId);
    if (change) {
      window.dispatchEvent(
        new CustomEvent("aiUndoChange", {
          detail: { snapshot: change.snapshotBefore },
        }),
      );
    }
    set((s) => ({
      pendingChanges: s.pendingChanges.filter((c) => c.id !== changeId),
    }));
  },
}));
