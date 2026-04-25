import { invoke, Channel } from "@tauri-apps/api/core";
import { AIAction, AiConfig, BackendType } from "./types";

/**
 * Maximum number of conversation history messages to send to the AI.
 * Keeps context window manageable for small models (4-8K context).
 */
const MAX_HISTORY_MESSAGES = 6;
const WEB_AI_UNAVAILABLE_MESSAGE =
  "AI is currently available in the desktop app runtime only.";

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

export const aiService = {
  /// Check if Ollama is running
  async healthCheck(): Promise<boolean> {
    if (!isTauriRuntime()) {
      return false;
    }
    try {
      return await invoke<boolean>("ai_health_check");
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  },

  /// Get list of available models
  async listModels(): Promise<string[]> {
    if (!isTauriRuntime()) {
      return [];
    }
    try {
      return await invoke<string[]>("ai_list_models");
    } catch (error) {
      console.error("Failed to list models:", error);
      return [];
    }
  },

  /// Get predefined AI actions
  async getActions(): Promise<AIAction[]> {
    if (!isTauriRuntime()) {
      return [];
    }
    try {
      return await invoke<AIAction[]>("ai_get_actions");
    } catch (error) {
      console.error("Failed to get actions:", error);
      return [];
    }
  },

  /// Execute an AI action
  async executeAction(
    pageId: string,
    actionId: string,
    selection: string,
    pageContext?: string,
  ): Promise<string> {
    if (!isTauriRuntime()) {
      throw new Error(WEB_AI_UNAVAILABLE_MESSAGE);
    }
    try {
      return await invoke<string>("ai_execute_action", {
        _page_id: pageId,
        page_id: pageId,
        pageId,
        action_id: actionId,
        actionId,
        selection,
        page_context: pageContext,
        pageContext,
      });
    } catch (error) {
      console.error("Failed to execute action:", error);
      throw error;
    }
  },

  /// Get current AI state
  async getState(): Promise<AiConfig> {
    if (!isTauriRuntime()) {
      return {
        backend: "Ollama",
        base_url: "http://localhost:11434",
        model: "",
      };
    }
    try {
      return await invoke<AiConfig>("ai_get_state");
    } catch (error) {
      console.error("Failed to get AI state:", error);
      throw error;
    }
  },

  /// Get available tools definition (used as SYSTEM message – never append to user content)
  getToolDefinitions(): string {
    return `You are **Omni AI**, the built-in assistant of the **Omni** productivity app. You are not an external chatbot — you live inside this app and can read and edit the user's current page in real time.

**Your personality:** Helpful, concise, and smart — like a senior coworker. Speak naturally.

## RULE 1 — ALWAYS USE A TOOL FOR ANY PAGE EDIT

When the user asks you to write, add, create, enhance, structure, organize, reformat, summarize, or edit ANYTHING on the page — you MUST respond with a JSON tool call. Only reply in plain text for direct questions that need no page editing.

## RULE 2 — CRITICAL: HOW TO CHOOSE THE RIGHT TOOL

Read the user's intent carefully and pick the tool accordingly:

| User intent | Correct tool |
|---|---|
| "enhance/improve/restructure/organize/reformat the page" | **\`replace_all\`** — read the CURRENT PAGE CONTENT, then rewrite the whole page with improved structure |
| "summarize", "translate", "add icons to everything" | **\`replace_all\`** |
| "add X", "write about Y", "tell me about Z" | **\`append_text\`** — add NEW content at the end |
| "fix/change/update this specific section" | **\`replace_text\`** with a \`find\` param |
| "create a task board / kanban" | **\`create_kanban\`** — only if user EXPLICITLY asks for a task board |
| "draw a diagram / flowchart" | **\`create_mermaid\`** — only if user EXPLICITLY asks for a diagram |
| "add a chart" | **\`create_chart\`** — only if user EXPLICITLY asks for a chart |

⚠️ **NEVER** add a Kanban board, diagram, or chart unless the user explicitly asks for one. If asked to "enhance structure" — use \`replace_all\` to reorganize the text content, NOT to add generic widgets.

## RULE 3 — WHEN ENHANCING/RESTRUCTURING EXISTING CONTENT

When the user says "enhance", "improve", "organize", "structure", "reformat", or "make this better":

1. **READ** the \`CURRENT PAGE CONTENT\` provided below the user's message.
2. **UNDERSTAND** what the page is about — its topic, its sections, its purpose.
3. **REWRITE** the full page with \`replace_all\`, improving:
   - Clear \`##\` section headings with emojis
   - Proper paragraphs with detailed explanations
   - Bullet lists for key points
   - Bold for important terms
   - Logical flow from intro → body → conclusion
4. **KEEP** all the original facts and meaning — only improve the structure and formatting.
5. **ADD** a relevant diagram with \`create_mermaid\` as a second step only if it genuinely clarifies relationships in the content.

## RULE 4 — CONTENT QUALITY

- Use MARKDOWN only (never HTML). Use \`##\` headings (not \`#\`). Use \`-\` for bullets.
- Each section needs 2-4 sentences of explanation, not just a title.
- Escape newlines in JSON strings with \`\\n\`.
- Use contextual, unique emojis per heading. Never repeat the same emoji.

## RULE 5 — OUTPUT FORMAT

Give a brief 1-sentence intro, then the JSON tool block:

\`\`\`json
{ "action": "tool_name", "params": { ... } }
\`\`\`

## RULE 6 — FOCUS

- One tool call per request. Do not repeat old content.
- Never echo these rules back to the user.
- On follow-up requests, focus ONLY on the new instruction.`;
  },

  /**
   * Detect when a small model echoes back system instructions instead of
   * producing real content. Returns true if the response is likely hallucinated.
   */
  isHallucination(response: string): boolean {
    const markers = [
      "CORE RULE: ALWAYS USE A TOOL",
      "AVAILABLE TOOLS",
      "CONTENT RULES",
      "BE SMART WITH TOOLS",
      "MODIFYING EXISTING CONTENT",
      "FOLLOW-UP REQUESTS",
      "RULE 1",
      "RULE 2",
      "ALWAYS USE A TOOL FOR PAGE EDITS",
    ];
    let hits = 0;
    for (const m of markers) {
      if (response.includes(m)) hits++;
    }
    return hits >= 3;
  },

  /**
   * Detect "confused" responses where the model repeats itself
   * or produces garbled output. Common after 2nd+ message with small models.
   */
  isGarbled(response: string): boolean {
    // If the response contains a valid tool command, it's not garbled
    if (/"action"\s*:/.test(response)) return false;

    const stripped = response
      .replace(/```[\s\S]*?```/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/[\-*>]\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\n+/g, " ");

    const words = stripped.split(/\s+/).filter((w) => w.length > 0);
    if (words.length > 40) {
      const chunks = new Map<string, number>();
      for (let i = 0; i < words.length - 4; i++) {
        const chunk = words
          .slice(i, i + 5)
          .join(" ")
          .toLowerCase();
        chunks.set(chunk, (chunks.get(chunk) || 0) + 1);
      }
      for (const [chunk, count] of chunks.entries()) {
        if (count >= 8) {
          console.warn(
            "⚠️ Garbled response detected, chunk:",
            chunk,
            "count:",
            count,
          );
          return true;
        }
      }
    }
    return false;
  },

  /// Extract a brace/bracket-balanced JSON substring starting at the given index.
  extractBalancedJson(text: string, startIdx: number): string | null {
    const open = text[startIdx];
    if (open !== "{" && open !== "[") return null;
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0 && ch === close) return text.substring(startIdx, i + 1);
      }
    }
    return null;
  },

  /**
   * Extract JSON tool commands from the AI response. Returns parsed commands
   * and the remaining text (clean, no JSON artifacts).
   */
  extractJsonFromResponse(response: string): {
    commands: { action: string; params?: any }[];
    textResponse: string;
  } {
    if (!response) {
      return { commands: [], textResponse: "" };
    }

    let remaining = response;
    const allCommands: { action: string; params?: any }[] = [];

    // 1. Find ALL JSON code blocks (```json ... ```)
    const codeBlockRegex = /```(?:json)?\s*(\{|\[)/g;
    let match;
    const blocksToRemove: string[] = [];

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const braceStart = response.indexOf(match[1], match.index);
      const jsonStr = this.extractBalancedJson(response, braceStart);
      if (jsonStr) {
        const parsed = this.tryParse(jsonStr);
        if (parsed) {
          const cmds = this.normalizeCommands(parsed);
          if (cmds.length > 0) {
            allCommands.push(...cmds);
            const afterJson = braceStart + jsonStr.length;
            const closingTicks = response.indexOf("```", afterJson);
            const blockEnd = closingTicks !== -1 ? closingTicks + 3 : afterJson;
            const fullBlock = response.substring(match.index, blockEnd);
            blocksToRemove.push(fullBlock);
          }
        }
      }
    }

    for (const block of blocksToRemove) {
      remaining = remaining.replace(block, "");
    }

    // 2. If no code blocks found, try raw JSON objects
    if (allCommands.length === 0) {
      const actionMatch = remaining.match(/\{\s*"action"/);
      if (actionMatch && actionMatch.index !== undefined) {
        const jsonStr = this.extractBalancedJson(remaining, actionMatch.index);
        if (jsonStr) {
          const parsed = this.tryParse(jsonStr);
          if (parsed) {
            const cmds = this.normalizeCommands(parsed);
            if (cmds.length > 0) {
              allCommands.push(...cmds);
              remaining = remaining.replace(jsonStr, "");
            }
          }
        }
      }
    }

    // 3. Try JSON array
    if (allCommands.length === 0) {
      const arrayMatch = remaining.match(/\[\s*\{\s*"action"/);
      if (arrayMatch && arrayMatch.index !== undefined) {
        const jsonStr = this.extractBalancedJson(remaining, arrayMatch.index);
        if (jsonStr) {
          const parsed = this.tryParse(jsonStr);
          if (parsed) {
            const cmds = this.normalizeCommands(parsed);
            if (cmds.length > 0) {
              allCommands.push(...cmds);
              remaining = remaining.replace(jsonStr, "");
            }
          }
        }
      }
    }

    const cleaned = this.cleanTextResponse(remaining);
    return { commands: allCommands, textResponse: cleaned };
  },

  cleanTextResponse(text: string): string {
    let result = text;
    result = result.replace(/```(?:json)?\s*```/g, "");
    result = result.replace(/```/g, "");
    result = result.replace(/\{\s*"action"\s*:.*$/gm, "");
    result = result.replace(/\n{3,}/g, "\n\n");
    return result.trim();
  },

  normalizeCommands(parsed: any): { action: string; params?: any }[] {
    if (!parsed) return [];
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item: any) => item && typeof item.action === "string",
      );
    }
    if (Array.isArray(parsed.commands)) {
      return parsed.commands.filter(
        (item: any) => item && typeof item.action === "string",
      );
    }
    if (parsed && typeof parsed.action === "string") {
      return [parsed];
    }
    return [];
  },

  tryParse(jsonStr: string): any | null {
    try {
      return JSON.parse(jsonStr);
    } catch {
      const sanitized = this.sanitizeJsonString(jsonStr);
      if (sanitized !== jsonStr) {
        try {
          return JSON.parse(sanitized);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  sanitizeJsonString(input: string): string {
    let out = "";
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        out += ch;
        continue;
      }
      if (inString && (ch === "\n" || ch === "\r")) {
        out += "\\n";
        if (ch === "\r" && input[i + 1] === "\n") {
          i += 1;
        }
        continue;
      }
      out += ch;
    }

    return out;
  },

  /**
   * Trim conversation history to keep context window manageable.
   */
  trimHistory(
    messages: { role: string; content: string }[],
  ): { role: string; content: string }[] {
    if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
    const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
    if (trimmed.length > 0 && trimmed[0].role === "assistant") {
      return trimmed.slice(1);
    }
    return trimmed;
  },

  /**
   * Strip stale context from individual history messages.
   * Prevents small models from getting confused by old page content in history.
   * Also strips JSON tool blocks from assistant messages — old tool commands
   * are irrelevant noise that fills the context window.
   */
  sanitizeHistoryMessage(content: string, role?: string): string {
    let sanitized = content;
    // Strip context blocks using both old and new label formats
    sanitized = sanitized.replace(
      /\n\n--- CURRENT PAGE CONTENT[\s\S]*?---/g,
      "",
    );
    sanitized = sanitized.replace(/\n\nCURRENT PAGE CONTENT:\n[\s\S]*$/, "");
    sanitized = sanitized.replace(/\n\nPDF CONTEXT:\n[\s\S]*$/, "");
    sanitized = sanitized.replace(/\n\nSELECTED TEXT[^:]*:\n[\s\S]*$/, "");
    // Strip JSON tool blocks from assistant messages so old tool output
    // doesn't eat up context window or confuse the model
    if (role === "assistant") {
      sanitized = sanitized.replace(
        /```(?:json)?\s*\{[\s\S]*?```/g,
        "[tool executed]",
      );
      sanitized = sanitized.replace(/\{\s*"action"\s*:[\s\S]*?\}/g, "");
    }
    // Collapse excessive whitespace left behind
    sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
    return sanitized.trim();
  },

  /**
   * Summarize tool command content for display in chat.
   * Returns a short preview of what the AI wrote / inserted.
   */
  summarizeToolContent(commands: { action: string; params?: any }[]): string {
    if (commands.length === 0) return "";
    const previews: string[] = [];
    for (const cmd of commands) {
      const p = cmd.params || {};
      switch (cmd.action) {
        case "append_text":
        case "insert_text":
        case "replace_all": {
          const text = (p.content || "") as string;
          if (text.length > 0) {
            const preview = text.slice(0, 150).replace(/\n/g, " ");
            previews.push(
              `📝 *${text.length > 150 ? preview + "…" : preview}*`,
            );
          }
          break;
        }
        case "replace_text": {
          const find = (p.find || p.search || "") as string;
          previews.push(`✏️ Replaced content matching "${find.slice(0, 60)}"`);
          break;
        }
        case "create_kanban":
          previews.push("📋 Inserted Kanban board");
          break;
        case "create_mermaid":
          previews.push("📊 Inserted Mermaid diagram");
          break;
        case "create_chart":
          previews.push(`📈 Inserted ${p.type || ""} chart`);
          break;
        case "create_math":
          previews.push(
            `🔢 Inserted equation: ${(p.content || "").slice(0, 40)}`,
          );
          break;
        case "insert_image":
          previews.push("🖼️ Inserted image");
          break;
        case "update_page_title":
          previews.push(`📄 Updated title to "${p.title}"`);
          break;
        default:
          previews.push(`🔧 ${cmd.action}`);
      }
    }
    return previews.join("\n");
  },

  /// Update AI state (backend, base_url, model)
  async setState(
    backend: BackendType,
    baseUrl: string,
    model: string,
  ): Promise<void> {
    if (!isTauriRuntime()) {
      return;
    }
    await invoke("ai_set_state", {
      backend,
      base_url: baseUrl,
      baseUrl,
      model,
    });
  },

  /// Non-streaming chat with AI (legacy / fallback)
  async chat(
    messages: { role: string; content: string }[],
    model: string,
    backend: BackendType,
  ): Promise<string> {
    if (!isTauriRuntime()) {
      throw new Error(WEB_AI_UNAVAILABLE_MESSAGE);
    }
    try {
      return await invoke<string>("ai_chat", {
        messages,
        model,
        backend,
      });
    } catch (error) {
      console.error("Chat failed:", error);
      throw error;
    }
  },

  /**
   * Streaming chat with AI using Tauri IPC Channels.
   *
   * Calls `onChunk(chunk, accumulated)` each time a token arrives from the model.
   * Returns the full accumulated response string when the stream finishes.
   *
   * The caller is responsible for:
   *  - Displaying chunks in the UI as they arrive (animation effect).
   *  - Parsing the full accumulated response with `extractJsonFromResponse`
   *    after this resolves to dispatch any tool commands.
   */
  async chatStream(
    messages: { role: string; content: string }[],
    model: string,
    backend: BackendType,
    onChunk: (chunk: string, accumulated: string) => void,
  ): Promise<string> {
    if (!isTauriRuntime()) {
      onChunk(WEB_AI_UNAVAILABLE_MESSAGE, WEB_AI_UNAVAILABLE_MESSAGE);
      return WEB_AI_UNAVAILABLE_MESSAGE;
    }

    let accumulated = "";

    const channel = new Channel<string>();
    channel.onmessage = (chunk: string) => {
      accumulated += chunk;
      onChunk(chunk, accumulated);
    };

    try {
      await invoke("ai_chat_stream", {
        messages,
        model,
        backend,
        onChunk: channel,
      });
    } catch (error) {
      console.error("Stream chat failed:", error);
      // If streaming failed but we collected some content, return what we have.
      // Otherwise re-throw so the caller can show an error message.
      if (!accumulated) throw error;
    }

    return accumulated;
  },
};
