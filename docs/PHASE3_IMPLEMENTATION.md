# Phase 3 Implementation Guide - AI Agent MVP

## ✅ What's Been Implemented

### Backend (Rust) - Complete

1. **Ollama Client** (`src-tauri/src/ai/ollama.rs`)

   - HTTP client for local LLM inference
   - Health checks and model listing
   - Generate (non-streaming) responses
   - Configurable temperature & token limits
   - Default: `llama3.2:3b` (3B parameters, fast)

2. **RAG Engine** (`src-tauri/src/ai/rag.rs`)

   - Context prompt builder from page content
   - Prepares structured prompts for LLM
   - Future: Full semantic search with embeddings

3. **Edit Operations** (`src-tauri/src/ai/operations.rs`)

   - 9 predefined AI actions (slash commands)
   - Insert/Replace/Delete/UpdatePage operations
   - Actions: Summarize, Rewrite, Expand, Explain, Outline, Tasks, Diagram, Table, Grammar

4. **Tauri Commands** (`src-tauri/src/lib.rs`)
   - `ai_health_check()` - Check if Ollama running
   - `ai_list_models()` - Get available models
   - `ai_get_actions()` - Get action definitions
   - `ai_execute_action()` - Run action with context
   - `ai_get_state()` - Current AI state

### Frontend (React) - Complete

1. **Types** (`src/features/ai/types.ts`)

   - AIAction, EditOperation, AgentPanelState

2. **Service** (`src/features/ai/aiService.ts`)

   - Wrapper for Tauri commands
   - Health check, model listing, action execution

3. **Hook** (`src/features/ai/useAgentPanel.ts`)

   - State management for AI panel
   - Periodic health checks (every 10s)
   - Action execution with loading state
   - Error handling

4. **UI Component** (`src/features/ai/AgentPanel.tsx`)

   - Full-screen slide-up panel
   - 9 action buttons (2x grid layout)
   - Status indicator (Ollama connected/offline)
   - Response display with copy button
   - Close on Escape key

5. **Integration** (`src/components/layout/AppLayout.tsx`)

   - Panel added to main layout
   - Text selection triggers panel open
   - Pass selected text to AI service

6. **Editor Integration** (`src/features/editor/OmniEditor.tsx`)
   - `onSelectText` callback when text selected
   - Triggers AI panel with selection

## 🚀 How to Use

### Prerequisites

1. **Install Ollama** from https://ollama.ai (one-time)
2. **Pull a model:**
   ```bash
   ollama pull llama3.2:3b      # Fast, recommended for MVP
   ollama pull llama3.2:8b      # Better quality (needs more VRAM)
   ```
3. **Start Ollama** (runs on `localhost:11434` by default)
   ```bash
   ollama serve
   ```

### Workflow

1. **Select Text** in editor

   - Triple-click or drag to select text
   - Selected text automatically triggers AI panel

2. **Choose Action**

   - Click action button (Summarize, Rewrite, etc.)
   - AI streams response

3. **Copy Result**

   - Copy response to clipboard
   - Paste into editor or elsewhere

4. **Status Indicator**
   - Green dot = Ollama connected ✓
   - Red dot = Ollama offline (start Ollama)

## 📋 Predefined AI Actions

| Action               | Icon | Description                              |
| -------------------- | ---- | ---------------------------------------- |
| **Summarize**        | 📝   | Create concise 2-3 sentence summary      |
| **Rewrite**          | ✏️   | Make more professional & concise         |
| **Expand**           | 📖   | Add detail, examples, depth              |
| **Explain**          | ❓   | Detailed explanation for beginners       |
| **Generate Outline** | 📋   | Create hierarchical structure (markdown) |
| **Generate Tasks**   | ✅   | Extract action items with checkboxes     |
| **Generate Diagram** | 📊   | Auto-create Mermaid diagram code         |
| **Generate Table**   | 📈   | Convert content to markdown table        |
| **Check Grammar**    | ✓    | Fix grammar, spelling, clarity           |

## 🔧 Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend (React/TypeScript)          │
├─────────────────────────────────────────────┤
│  AppLayout                                   │
│  ├── OmniEditor (text selection handler)     │
│  └── AgentPanel (UI + useAgentPanel hook)    │
│      └── aiService (Tauri invoke)            │
└────────────────┬────────────────────────────┘
                 │
          Tauri IPC Bridge
                 │
┌────────────────┴────────────────────────────┐
│      Backend (Rust + Tauri Plugins)          │
├─────────────────────────────────────────────┤
│  AI Module                                   │
│  ├── ollama.rs (HTTP → Ollama)               │
│  ├── rag.rs (Context builder)                │
│  └── operations.rs (Action definitions)      │
│                                              │
│  Tauri Commands                              │
│  └── ai_execute_action()                    │
│      ├── Call Ollama client                  │
│      ├── Build context prompt                │
│      └── Return response                     │
└─────────────────────────────────────────────┘
                 │
         ┌───────┘
         ↓
   ┌──────────────┐
   │   Ollama     │
   │ llama3.2:3b  │
   └──────────────┘
   (localhost:11434)
```

## 🧪 Testing Checklist

- [ ] **Ollama Running**: `curl http://localhost:11434/api/tags`
- [ ] **Backend Compiles**: `cd src-tauri && cargo check`
- [ ] **Frontend Compiles**: `npm run build`
- [ ] **Health Check**: Open app, panel shows "Ollama connected" (green dot)
- [ ] **Select Text**: Triple-click text in editor → panel opens
- [ ] **Execute Action**: Click "Summarize" → waits for response
- [ ] **Response Display**: AI text appears in panel
- [ ] **Copy Button**: Click Copy → response in clipboard
- [ ] **Close Panel**: Press Escape or click X

## ⚙️ Configuration

### Model Selection

Edit `src-tauri/src/lib.rs` line ~260:

```rust
pub struct AiState {
    pub model: String,  // Change from "llama3.2:3b" to other model
}
```

### Ollama URL

In `src/features/ai/aiService.ts`, model is hardcoded but can be parameterized:

```typescript
// Currently: localhost:11434 (default Ollama port)
// To change: Update OllamaClient::new() call
```

### Temperature & Tokens

In `useAgentPanel.ts` `executeAction()`:

```typescript
const response = await aiService.executeAction(
  pageId,
  actionId,
  state.selectedText,
  pageContext
  // Temperature: 0.7 (creative)
  // Max tokens: 500 (response limit)
);
```

## 📝 Next Steps (Phase 3.2)

1. **Streaming Responses** - Real-time token streaming
2. **Block Edit Integration** - Apply AI changes directly to blocks
3. **PDF Ingestion** - Extract text from uploaded PDFs
4. **OCR for Images** - Tesseract integration
5. **Semantic Search** - Embed chunks in SQLite
6. **Custom Models** - Let users select from available models
7. **Prompt Templates** - Save custom system prompts
8. **Chat History** - Persist AI interactions

## 🐛 Troubleshooting

### "Ollama offline" red dot

- Ensure Ollama is running: `ollama serve`
- Check port: `curl http://localhost:11434/api/tags`
- Health check runs every 10 seconds

### "Failed to execute action" error

- Check Ollama process is running
- Check model exists: `ollama list`
- Check console for error details

### Slow responses

- Model too large for hardware
- Try smaller model: `ollama pull llama3.2:3b` (1.3GB)
- Currently set to 3B, reduce to 1B if needed

### App crashes on text selection

- Check browser console for JS errors
- Ensure OmniEditor receives `onSelectText` prop
- Verify Tauri commands registered in `lib.rs`

## 📚 Related Files

**Rust Backend:**

- Dependencies: `src-tauri/Cargo.toml` (reqwest, tokio, thiserror)
- AI Module: `src-tauri/src/ai/`
- Commands: `src-tauri/src/lib.rs` (ai\_\* functions)

**React Frontend:**

- AI Features: `src/features/ai/`
- Integration: `src/components/layout/AppLayout.tsx`
- Editor: `src/features/editor/OmniEditor.tsx`

**Database:**

- Schema: `src-tauri/src/database/schema.rs`
- Tables: pages, blocks, chunks (ready for RAG)
- FTS5: Full-text search for fast retrieval
