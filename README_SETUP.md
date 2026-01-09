# 📚 Omni Workspace - Complete Setup & Guide

A powerful **Notion-like offline-first productivity workspace** with AI integration, built with React, Tauri, and local LLMs.

---

## 🎯 What Is Omni Workspace?

Omni is a feature-rich note-taking and task management platform combining:

- ✍️ **Block-based editor** (Notion-style)
- 📅 **Calendar & event management** with deadline tracking
- ✅ **Kanban task board** (Trello-style drag & drop)
- 📊 **Visualizations** (Mermaid diagrams, Charts, Kanban boards)
- 🧮 **Math formulas** (KaTeX support)
- 🤖 **Local AI assistant** (powered by Ollama + LLMs)
- 📁 **Hierarchical pages** (folders, sub-pages, full-text search)
- 💾 **Offline-first** (all data stored locally on your device)

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Rust** - [Install Rustup](https://rustup.rs/)
- **Tauri CLI** - `npm install -g @tauri-apps/cli`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Youssef-Ashraf2099/Organizer.git
cd Organizer

# 2. Install dependencies
npm install

# 3. Build and run the app
npm run tauri dev
```

The app will open automatically. 🎉

### Optional: Build for Production

```bash
npm run tauri build
# Executable will be in src-tauri/target/release/bundle/
```

---

## 📋 Project Structure

```
Organizer/
├── src/                              # Frontend (React + TypeScript)
│   ├── features/                     # Feature modules
│   │   ├── editor/                   # BlockNote editor with custom blocks
│   │   ├── sidebar/                  # Page tree & navigation
│   │   ├── calendar/                 # Calendar & events
│   │   ├── todo/                     # Kanban task board
│   │   ├── ai/                       # AI chat & agent panel
│   │   └── ...
│   ├── components/
│   │   └── layout/                   # Main app layout
│   ├── core/
│   │   ├── db/                       # Tauri IPC bridge to Rust
│   │   ├── store/                    # Zustand state management
│   │   └── services/                 # Business logic
│   └── App.tsx                       # Root component
│
├── src-tauri/                        # Backend (Rust)
│   ├── src/
│   │   ├── database/                 # SQLite schema & queries
│   │   ├── ai/                       # AI engine
│   │   │   ├── ollama.rs             # Ollama HTTP client
│   │   │   ├── rag.rs                # Retrieval-Augmented Generation
│   │   │   └── operations.rs         # AI actions
│   │   └── lib.rs                    # Tauri command registry
│   └── Cargo.toml                    # Rust dependencies
│
├── docs/                             # Documentation
│   ├── phase1.md                     # Core foundation (implemented ✅)
│   ├── phase2.md                     # Assets & templates (implemented ✅)
│   ├── phase3.md                     # AI & RAG (implemented ✅)
│   ├── PHASE3_IMPLEMENTATION.md      # AI details
│   ├── VISUAL_FEATURES.md            # Diagrams, charts, Kanban
│   └── MATH_FORMULA_SETUP.md         # Math formula support
│
└── package.json                      # Frontend dependencies
```

---

## 📖 Development Phases

### **Phase 1: The Reliable Core** ✅ Complete

**Goal:** Build a stable, offline-first Notion clone with hierarchical pages.

**Features Delivered:**

- 📁 **Hierarchical Sidebar**: Recursive page tree (Folders → Pages → Sub-pages)
- 🗂️ **Block-Based Editor**: BlockNote with "/" command menu
- 💾 **Auto-Save Engine**: Debounced save every 800ms
- 🔍 **Global Search**: SQLite FTS5 full-text search (Cmd+K)
- 🗄️ **SQLite Database**: Stored in `%APPDATA%\Local\Omni Workspace`

**Key Components:**

- `src/features/editor/OmniEditor.tsx` - Main editor
- `src/features/sidebar/Sidebar.tsx` - Page tree
- `src-tauri/src/database/` - Schema & queries

---

### **Phase 2: Assets & Templates** ✅ Complete

**Goal:** Support file uploads, templates, and export/import.

**Features Delivered:**

- 🖼️ **Image/File Support**: Drag & drop images into editor
- 📄 **PDF Storage**: Upload PDFs to knowledge base
- 🎨 **Templates**: Save pages as reusable templates
- 💾 **Export/Import**: Markdown and JSON file support
- 📊 **Visual Blocks**: Mermaid diagrams, Charts, Kanban boards
- 🧮 **Math Formulas**: KaTeX LaTeX support

**Key Components:**

- `src/features/editor/ImageBlock.tsx` - Image handling
- `src/features/editor/MermaidBlock.tsx` - Diagrams
- `src/features/editor/ChartBlock.tsx` - Data visualization
- `src/features/editor/MathBlock.tsx` - Formula support

---

### **Phase 3: AI & RAG Integration** ✅ Complete

**Goal:** Add AI-powered assistance using local LLMs and RAG.

**Features Delivered:**

- 🤖 **Local AI Engine**: Connects to Ollama (llama3.2:3b default)
- 💬 **AI Chat**: Ask questions about your notes
- ✨ **9 AI Actions**:
  - 📝 Summarize - Create concise summaries
  - ✏️ Rewrite - Improve writing quality
  - 📖 Expand - Add detail and depth
  - ❓ Explain - Detailed explanations
  - 📋 Generate Outline - Create structure
  - ✅ Generate Tasks - Extract action items
  - 📊 Generate Diagram - Auto-create diagrams
  - 📈 Generate Table - Convert to markdown tables
  - ✓ Check Grammar - Fix spelling & grammar

**Key Components:**

- `src/features/ai/AIChat.tsx` - Chat interface
- `src/features/ai/AgentPanel.tsx` - Action buttons
- `src-tauri/src/ai/` - Ollama integration
- `src/features/ai/aiService.ts` - Service layer

---

## 🤖 AI Setup Guide (Phase 3)

### Step 1: Install Ollama

Ollama is a lightweight framework for running LLMs locally on your machine.

**Windows:**

1. Visit [ollama.ai](https://ollama.ai)
2. Click "Download for Windows"
3. Run the installer
4. Follow the setup wizard

**macOS:**

```bash
brew install ollama
```

**Linux:**

```bash
curl https://ollama.ai/install.sh | sh
```

### Step 2: Pull a Model

Open a terminal and run:

```bash
# Fast model (recommended for MVP) - 1.3GB
ollama pull llama3.2:3b

# Better quality but slower - 4GB
ollama pull llama3.2:8b

# Or any other supported model
ollama pull mistral
ollama pull neural-chat
```

View available models: [ollama.ai/library](https://ollama.ai/library)

### Step 3: Start Ollama Server

```bash
ollama serve
```

You should see:

```
2024/01/09 10:00:00 Listening on 127.0.0.1:11434
```

**Ollama runs on `localhost:11434` by default.**

### Step 4: Verify Connection

In another terminal:

```bash
curl http://localhost:11434/api/tags
```

Response will list your models (JSON format).

### Step 5: Use AI in the App

1. **Open Organizer** and go to **AI Chat** tab
2. **Check status**: Should show "Connected" with green dot
3. **Select text** in editor → AI panel opens
4. **Choose an action** → AI processes & responds
5. **Chat**: Type questions about your notes

---

## 🎮 Using Features

### 📝 Block-Based Editor

- Type `/` to open command menu
- Blocks: text, headings, lists, images, code, math, diagrams, charts, Kanban
- Auto-saves every 800ms
- Supports undo/redo (Ctrl+Z, Ctrl+Y)

### 📅 Calendar & Events

- **Add Event**: Click a date, then "+ Add Another Event"
- **Event Tags**: Quiz, University, Final, Meeting, Deadline, Birthday, Hangout
- **Deadline Tracking**: Events tagged "Deadline" show **days left** countdown
  - ⏰ Overdue (red) | Today! (yellow) | Xd left (green/orange/blue)
- **Link to Tasks**: Attach event to task for tracking

### ✅ Kanban Board

- **Columns**: Backlog, To Do, In Progress, Done
- **Add Task**: Click "+ Add Task" in any column
- **Drag & Drop**: Move cards between columns
- **Task Details**: Priority, tags, subtasks, checklists

### 📊 Visualizations

- **Mermaid Diagrams**: `/mermaid` for flowcharts, ERD, sequence diagrams
- **Charts**: `/chart` for bar/line/pie charts
- **Kanban Board**: `/kanban` for Trello-style boards
- Click "Edit" to modify, "Preview" to view

### 🧮 Math Formulas

- **Insert Math**: `/math` or click ƒ(x) button
- **Syntax**: Full LaTeX support (KaTeX)
- **Examples**: `E = mc^2`, `\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`, `\int_0^\infty`

### 💬 AI Assistant

- **Chat Tab**: Ask questions, get answers powered by local LLM
- **Text Selection**: Select text in editor → AI panel auto-opens
- **9 Actions**: Summarize, Rewrite, Expand, Explain, Outline, Tasks, Diagram, Table, Grammar
- **PDF Upload**: Attach PDFs → AI includes content in responses

---

## 🔧 Configuration

### Change Default AI Model

Edit `src-tauri/src/lib.rs`:

```rust
pub struct AiState {
    pub model: String,  // Change from "llama3.2:3b" to "mistral" or other
}
```

Then rebuild:

```bash
npm run tauri dev
```

### Change Ollama URL

In `src/features/ai/AIChat.tsx`:

```typescript
const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:1234");
// Change "1234" to your Ollama port (default: 11434)
```

### Adjust AI Response Length

In `src/features/ai/useAgentPanel.ts`, find `temperature` and `max_tokens`:

```typescript
// temperature: 0.7 (higher = more creative)
// max_tokens: 500 (response limit)
```

---

## 🐛 Troubleshooting

### "Ollama Disconnected" (Red Dot)

**Problem**: AI panel shows "Disconnected" status.

**Solution**:

1. Ensure Ollama is running: `ollama serve`
2. Check port: `curl http://localhost:11434/api/tags`
3. If failed, restart Ollama
4. Check firewall isn't blocking port 11434

### "Failed to Get Response" Error

**Problem**: AI action fails with error message.

**Solution**:

1. Verify model exists: `ollama list`
2. Check console for detailed error
3. Try simpler action (e.g., Summarize)
4. Reduce response length in settings

### Slow Responses

**Problem**: AI takes 30+ seconds to respond.

**Solution**:

1. Check available VRAM: `ollama list -v`
2. Try smaller model: `ollama pull llama3.2:3b` (1.3GB)
3. Close other apps consuming memory
4. Check CPU usage while generating

### App Crashes on Startup

**Problem**: App won't launch or immediately crashes.

**Solution**:

1. Delete cache: `%APPDATA%\Local\Omni Workspace`
2. Clear localStorage: DevTools → Application → Clear All
3. Rebuild: `npm run tauri dev`
4. Check browser console for errors (F12)

### Data Lost After Restart

**Problem**: Notes/tasks disappeared.

**Solution**:

1. Check if autosave is enabled (should be automatic)
2. Look in `%APPDATA%\Local\Omni Workspace\` for database files
3. Check browser localStorage isn't disabled
4. Enable DevTools → Disable cache if checked

---

## 📚 Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Frontend (React/TypeScript)          │
├─────────────────────────────────────────────┤
│  AppLayout                                   │
│  ├── OmniEditor (block editor)               │
│  ├── Sidebar (page navigation)               │
│  ├── Calendar (events & deadlines)           │
│  ├── TodoList (Kanban board)                 │
│  └── AIChat (chat interface)                 │
│      ├── AgentPanel (action buttons)         │
│      └── aiService (Tauri IPC)               │
└────────────────┬────────────────────────────┘
                 │
          Tauri IPC Bridge
                 │
┌────────────────┴────────────────────────────┐
│      Backend (Rust + Tauri Plugins)          │
├─────────────────────────────────────────────┤
│  Database Layer                              │
│  ├── SQLite (schema.rs, queries.rs)          │
│  └── Tables: pages, blocks, chunks, tasks    │
│                                              │
│  AI Module                                   │
│  ├── ollama.rs (HTTP client)                 │
│  ├── rag.rs (context builder)                │
│  └── operations.rs (action definitions)      │
│                                              │
│  Tauri Commands                              │
│  ├── ai_health_check()                       │
│  ├── ai_list_models()                        │
│  ├── ai_execute_action()                     │
│  └── db_* (database operations)              │
└─────────────────────────────────────────────┘
         │
         ↓ HTTP
    ┌──────────────┐
    │   Ollama     │
    │ llama3.2:3b  │
    │ localhost    │
    │   :11434     │
    └──────────────┘
    (runs separately)
```

---

## 🧪 Testing Checklist

- [ ] App launches without errors
- [ ] Can create new pages
- [ ] Can add blocks (text, image, code, etc.)
- [ ] Auto-save works (check DB file timestamp)
- [ ] Calendar events display correctly
- [ ] Kanban drag & drop functional
- [ ] Search finds content (Cmd+K)
- [ ] Ollama connects (green dot in AI Chat)
- [ ] AI action produces response
- [ ] PDF upload & text extraction works

---

## 📦 Dependencies

### Frontend

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **BlockNote** - Editor core
- **Zustand** - State management
- **React Markdown** - Markdown rendering
- **Mermaid** - Diagram rendering
- **Chart.js** - Data visualization
- **KaTeX** - Math formula rendering
- **pdfjs-dist** - PDF text extraction

### Backend

- **Tauri** - Desktop app framework
- **Rust** - System programming
- **SQLite** - Local database
- **reqwest** - HTTP client
- **tokio** - Async runtime
- **serde/serde_json** - Serialization

### External Services

- **Ollama** - Local LLM inference
- **llama3.2** - Language model (optional alternatives: mistral, neural-chat)

---

## 🚀 Advanced Usage

### Custom AI Prompts

Edit `src-tauri/src/ai/operations.rs` to add custom prompts:

```rust
AiOperation::Summarize => {
    prompt = format!(
        "Summarize this in 2-3 sentences:\n\n{}",
        content
    );
}
```

### Add New Event Tags

Edit `src/features/calendar/Calendar.tsx`:

```typescript
const EVENT_TAGS = [
  { name: "custom", color: "#abc123", label: "🎯 Custom" },
  // ... existing tags
];
```

### Custom Block Types

Edit `src/features/editor/OmniEditor.tsx` and add new block schema using BlockNote's API.

### Export Data

Manually export from `%APPDATA%\Local\Omni Workspace\`:

- Copy entire folder for backup
- Or export individual pages as Markdown

---

## 📝 Keyboard Shortcuts

| Shortcut       | Action                    |
| -------------- | ------------------------- |
| `/`            | Open block menu in editor |
| `Cmd/Ctrl + K` | Global search             |
| `Cmd/Ctrl + Z` | Undo                      |
| `Cmd/Ctrl + Y` | Redo                      |
| `Escape`       | Close modal/panel         |
| `Enter`        | Confirm action            |

---

## 🤝 Contributing

Found a bug or want to add a feature? Open an issue with:

- Description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

---

## 📄 License

This project is open source. Check LICENSE file for details.

---

## 🎓 Learning Resources

- **BlockNote Docs**: [blocknote.dev](https://www.blocknote.dev/)
- **Tauri Docs**: [tauri.app](https://tauri.app/)
- **Ollama Library**: [ollama.ai/library](https://ollama.ai/library)
- **SQLite Guide**: [sqlite.org](https://www.sqlite.org/)
- **KaTeX Docs**: [katex.org](https://katex.org/)
- **Mermaid Diagrams**: [mermaid.js.org](https://mermaid.js.org/)

---

## 💡 Next Steps (Future Phases)

### Phase 3.2: Enhanced AI

- [ ] Streaming responses for faster feedback
- [ ] Direct block editing via AI
- [ ] Full semantic search with embeddings
- [ ] Custom system prompts
- [ ] Chat history persistence

### Phase 4: Collaboration

- [ ] Real-time sync across devices
- [ ] Team workspaces
- [ ] Shared templates
- [ ] Comments & mentions

### Phase 5: Mobile

- [ ] iOS/Android apps
- [ ] Cloud sync option
- [ ] Offline-first PWA
- [ ] Push notifications

---

**Last Updated**: January 9, 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅

For questions or support, open an issue on [GitHub](https://github.com/Youssef-Ashraf2099/Organizer).

Happy organizing! 🚀
