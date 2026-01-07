📍 Phase 1: The Reliable Core
Goal: Build a stable, offline-first Notion clone with hierarchical pages and auto-save.

Key Deliverables:
SQLite Foundation: Initialize the database in the system's AppLocalData folder.

Hierarchical Sidebar: Implement a recursive page tree (Folders > Pages > Sub-pages).

Block-Based Editor: Integrate BlockNote with a "/" command menu.

Auto-Save Engine: Implement a debounced save system that updates the blocks table every 800ms while typing.

Global Search: Command+K search using SQLite FTS5 for instant text lookup across all pages.