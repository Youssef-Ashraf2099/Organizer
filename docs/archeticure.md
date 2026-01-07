Root/
├── src-tauri/                 # Rust Backend (The Core)
│   ├── src/
│   │   ├── database/          # SQLite logic & Schema
│   │   │   ├── mod.rs         # Database initialization
│   │   │   ├── migrations.rs  # Schema version control
│   │   │   └── queries.rs     # SQL queries (CTE, Search)
│   │   └── lib.rs             # Tauri Command Registry
│   ├── bin/                   # Binary sidecars (Future AI engines)
│   └── tauri.conf.json        # Permissions & App config
└── src/                       # Frontend (React)
    ├── core/                  # Singleton services
    │   ├── db/                # Tauri IPC bridge
    │   ├── store/             # Zustand (State management)
    │   └── ai/                # AI Gateway (Dormant in M1)
    ├── features/              # Feature modules
    │   ├── editor/            # BlockNote implementation
    │   ├── sidebar/           # Page tree & navigation
    │   └── knowledge/         # PDF & File management (M2)
    └── components/            # UI Kit (Shadcn, Tailwind)