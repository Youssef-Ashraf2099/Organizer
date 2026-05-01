# Omni Workspace — Codebase Instructions

> A Notion-like productivity app built with **Tauri 2 + React + Rust**.

---

## Tech Stack

| Layer         | Technology                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Desktop Shell | Tauri 2 (Rust)                                                                                             |
| Frontend      | React 19, TypeScript, Vite                                                                                 |
| Editor        | BlockNote (TipTap-based block editor)                                                                      |
| Styling       | Tailwind CSS, Framer Motion                                                                                |
| State         | Zustand (persisted to localStorage & SQLite)                                                               |
| Database      | SQLite via `@tauri-apps/plugin-sql`                                                                        |
| AI Backend    | (Removed — AI features were previously part of the app and have been removed for a fresh reimplementation) |
| PDF           | pdfjs-dist (client-side text extraction)                                                                   |
| Charts        | Chart.js + react-chartjs-2                                                                                 |
| Diagrams      | Mermaid.js                                                                                                 |
| Math          | KaTeX                                                                                                      |

---

## Project Structure

```
├── src/                          # React frontend
│   ├── App.tsx                   # Root component (CursorEffect + AppLayout)
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles + AI animation CSS
│   ├── components/
│   │   └── layout/
│   │       └── AppLayout.tsx     # Main layout: sidebar + editor + panels
│   ├── core/
│   │   ├── db/sqlite.ts          # DB connection URL constant
│   │   ├── services/fileService.ts # File upload utilities
│   │   ├── store/
│   │   │   ├── pageStore.ts      # Zustand store — pages CRUD, tree hierarchy
│   │   │   ├── chatStore.ts      # Zustand store — AI conversations (persisted)
│   │   │   └── templateStore.ts  # Zustand store — page templates
│   │   └── templates/
│   │       └── builtinTemplates.ts # Default page templates
│   ├── features/
│   │   ├── ai/                   # ★ AI SYSTEM (removed) — previously contained frontend AI tooling
│   │   ├── editor/               # ★ EDITOR (see detailed section below)
│   │   │   ├── OmniEditor.tsx    # Main BlockNote editor + AI tool handler
│   │   │   ├── markdownParser.ts # Markdown/HTML → BlockNote block converter
│   │   │   ├── MathBlock.tsx     # KaTeX math block
│   │   │   ├── MermaidBlock.tsx  # Mermaid diagram block
│   │   │   ├── ChartBlock.tsx    # Chart.js block
│   │   │   ├── KanbanBlock.tsx   # Kanban board block
│   │   │   ├── ImageBlock.tsx    # Image block with URL/upload
│   │   │   ├── VideoBlock.tsx    # Video block
│   │   │   ├── AudioBlock.tsx    # Audio block
│   │   │   └── PdfBlock.tsx      # PDF viewer block
│   │   ├── sidebar/Sidebar.tsx   # Page tree navigation
│   │   ├── calendar/Calendar.tsx # Calendar view
│   │   ├── todo/TodoList.tsx     # Todo list view
│   │   └── templates/            # Template picker/manager UI
│   ├── lib/utils.ts              # cn() utility (clsx + tailwind-merge)
│   └── types/                    # Shared TypeScript types
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── lib.rs                # Tauri command registrations
│   │   ├── ai/                   # AI backend module (removed)
│   │   └── database/
│   │       ├── mod.rs            # Database module
│   │       ├── schema.rs         # SQLite migrations (pages, blocks, assets, templates, FTS5)
│   │       └── queries.rs        # Database query functions
│   ├── tauri.conf.json           # Tauri configuration
│   └── Cargo.toml                # Rust dependencies
```

---

## AI Features

The project previously included a built-in AI assistant (Omni AI). Those AI frontend and backend modules have been removed from this codebase to allow a fresh reimplementation. If you are reintroducing AI functionality, add a dedicated design doc and reintroduce any backend services and commands intentionally.

---

## Editor System — Detailed Architecture

### BlockNote Editor (`OmniEditor.tsx`)

The editor uses **BlockNote** (built on TipTap/ProseMirror) with a custom schema supporting:

- Standard blocks: paragraph, heading (1-6), bullet list, numbered list
- Custom blocks: `math`, `mermaid`, `chart`, `kanban`, `image`, `video`, `audio`, `pdf`

### Custom Block Components

| Block           | File               | Props                               |
| --------------- | ------------------ | ----------------------------------- |
| Math (KaTeX)    | `MathBlock.tsx`    | `latex: string`                     |
| Mermaid diagram | `MermaidBlock.tsx` | `code: string`                      |
| Chart.js        | `ChartBlock.tsx`   | `type: string, data: string (JSON)` |
| Kanban          | `KanbanBlock.tsx`  | columns & cards                     |
| Image           | `ImageBlock.tsx`   | `url: string, caption: string`      |
| Video           | `VideoBlock.tsx`   | URL-based                           |
| Audio           | `AudioBlock.tsx`   | URL-based                           |
| PDF             | `PdfBlock.tsx`     | PDF file viewer                     |

### Markdown Parser (`markdownParser.ts`)

Converts markdown strings to BlockNote `PartialBlock[]` arrays:

- `markdownToBlocks(markdown)` — Main function. Auto-detects HTML (`/<[a-z][\s\S]*>/i`) and pre-processes with `htmlToMd()`.
- `htmlToMd(input)` — Converts HTML tags (h1-h6, strong, em, code, li, p, br) to markdown equivalents.
- `htmlToMarkdown(html)` — DOM-based HTML-to-markdown for paste handling.
- `parseInlineFormatting(text)` — Handles `**bold**`, `*italic*`, `` `code` `` → BlockNote inline content.

### Page Context Extraction (for AI)

When the AI needs to read the current page, `OmniEditor` responds to a `"getPageContent"` event by walking all BlockNote blocks and producing proper markdown:

- Headings → `# `, `## `, `### `
- Bullets/numbered lists → `- `, `1. `
- Custom blocks → `[mermaid]: ...`, `[math]: ...`, `[chart]: ...`
- Plain paragraphs → as-is

### AI Editor Animations (`aiEditorAnimations.ts`)

Visual feedback when AI modifies the page:

- **Slide-in** (`.ai-block-insert`): New blocks slide in from the left with a fade
- **Highlight** (`.ai-edit-highlight`): Blue glow on edited blocks
- **Replace** (`.ai-replace-in`): Cross-fade for replaced content
- **Skeleton** (`.ai-skeleton`): Loading placeholder during AI processing
- CSS lives in `index.css` **outside** `@layer base` for proper specificity

### Autosave

Content autosaves to SQLite after 1 second of inactivity (`AUTOSAVE_DELAY = 1000`).

---

## Database Schema (SQLite)

Defined in `src-tauri/src/database/schema.rs`:

| Table        | Purpose                                               |
| ------------ | ----------------------------------------------------- |
| `pages`      | Recursive page hierarchy (id, parent_id, title, icon) |
| `blocks`     | Page content as JSON (BlockNote format)               |
| `documents`  | Sidecar PDF storage paths                             |
| `chunks`     | RAG-ready text chunks with embedding BLOBs            |
| `fts_blocks` | FTS5 virtual table for full-text search on blocks     |
| `assets`     | File storage metadata (images, etc.)                  |
| `templates`  | Page templates (builtin + user-created)               |

FTS5 is maintained by `AFTER INSERT/UPDATE/DELETE` triggers on the `blocks` table.

---

## Rust Backend (`src-tauri/`)

### Note on AI backend

The `src-tauri/src/ai/` backend module and related Tauri commands were removed. Reintroduce carefully with clear security and dependency considerations if needed.

### Tauri Commands (invoked from frontend)

- `ai_health_check` → `bool`
- `ai_list_models` → `Vec<String>`
- `ai_get_actions` → predefined AI actions
- `ai_execute_action` → run a named action with page context
- `ai_get_state` → current `AiConfig`
- `ai_set_state` → update backend/url/model
- `ai_chat` → send message array, get response string

---

## State Management

| Store          | File               | Persistence                        | Key Fields                                            |
| -------------- | ------------------ | ---------------------------------- | ----------------------------------------------------- |
| Page Store     | `pageStore.ts`     | SQLite                             | `pages`, `childrenMap`, `rootPageIds`, `activePageId` |
| Chat Store     | `chatStore.ts`     | localStorage (`omni-chat-storage`) | `conversations[]`, `activeConversationId`             |
| Template Store | `templateStore.ts` | SQLite                             | `templates`, `isLoading`                              |

---

## Key Conventions

### Code Style

- **TypeScript** with strict mode. No `any` except where BlockNote's API requires it.
- **Functional components** with hooks. No class components.
- **Zustand** for state. No Redux, no Context API for global state.
- **`cn()` utility** (`lib/utils.ts`) for conditional Tailwind classes (clsx + tailwind-merge).

### AI Tool Definitions

- Tool definitions live in `aiService.getToolDefinitions()` — **always sent as a system message**, never appended to user content.
- Content must be **markdown**, never HTML. The `markdownParser.ts` has an HTML fallback converter, but the system prompt explicitly forbids HTML output.
- The AI should use **emoji/unicode icons** (♟️ ⚔️ 🏰 📝 etc.) to make content visually appealing.
- When modifying existing content, the AI should use `replace_all` (whole-page changes) or `replace_text` with `find` param (targeted edits) — never just appending duplicated content.

### Event-Based Communication (Editor ↔ AI)

- `window.dispatchEvent(new CustomEvent("getPageContent"))` → Editor responds by setting `window.__currentPageContent`
- `window.dispatchEvent(new CustomEvent("aiToolCommand", { detail: { action, params } }))` → Editor executes the tool
- This decouples the AI panel from the editor — they communicate through DOM events.

### Animation CSS

- AI animation classes (`.ai-block-insert`, `.ai-edit-highlight`, `.ai-replace-in`, `.ai-skeleton`) are defined in `index.css` **outside** `@layer base {}` with `!important` flags for proper specificity over BlockNote's styles.

### Error Handling Patterns

- Rust errors: `thiserror` derive macros → `Result<T, CustomError>`
- Frontend: try/catch with `console.error` + user-visible error states
- AI responses: hallucination guard + JSON parse fallbacks + sanitization

---

## Development

```bash
# Install dependencies
npm install

# Run in development (starts both Vite and Tauri)
npm run tauri dev

# Build for production
npm run tauri build
```

### Prerequisites

- Node.js 18+
- Rust toolchain (rustup)
- Tauri CLI v2 (`npm install -g @tauri-apps/cli`)
- LM Studio running at `http://127.0.0.1:1234` with a model loaded (default: `llama-3.2-3b-instruct`)

---

## Common Pitfalls & Notes

1. **Small model JSON output**: Models like llama-3.2-3b often skip code block markers around JSON. The brace-balanced extractor in `extractJsonFromResponse` handles this, but always test JSON extraction when changing tool definitions.

2. **BlockNote custom blocks**: When adding new custom blocks, register them in the schema in `OmniEditor.tsx`, create the React component, and add a corresponding tool action in both `aiService.getToolDefinitions()` and the `handleToolCommand` switch in `OmniEditor.tsx`.

3. **System prompt size**: The tool definitions system prompt is large. With small context windows (e.g., 4K tokens), it can crowd out conversation history. Monitor token usage.

4. **HTMLtoMd fallback**: If the AI outputs HTML despite instructions, `markdownToBlocks()` auto-detects and converts it. This should be a safety net, not the normal path.

5. **`replace_all` caution**: This tool clears the entire page. The AI is instructed to copy existing content and modify it, but verify the AI isn't dropping content when using this tool.

6. **Event timing**: The `getPageContent` event uses a polling loop (10 × 50ms) to wait for the editor to respond. If the editor hasn't mounted yet, page content will be empty.
