use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: r#"
                -- Pages Table (Recursive Hierarchy)
                CREATE TABLE IF NOT EXISTS pages (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT,
                    title TEXT NOT NULL,
                    icon TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
                );

                -- Blocks Table (Content)
                CREATE TABLE IF NOT EXISTS blocks (
                    id TEXT PRIMARY KEY,
                    page_id TEXT NOT NULL,
                    content JSON NOT NULL, -- Stringified BlockNote JSON
                    sort_order REAL NOT NULL,
                    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
                );

                -- Documents Table (Sidecar PDF Storage)
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL, -- Relative to AppLocalData/documents/  
                    hash TEXT,
                    metadata JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Chunks Table (RAG Ready - Vectors)
                -- Note: Embedding column will be standard BLOB for now,        
                -- ready for sqlite-vec 'float32' interpretation later.
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    embedding BLOB,
                    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
                );

                -- FTS5 Contentless Virtual Table for Instant Search
                -- Indexing blocks content.
                CREATE VIRTUAL TABLE IF NOT EXISTS fts_blocks USING fts5(       
                    content,
                    content='blocks',
                    content_rowid='rowid'
                );

                -- Triggers for FTS maintenance
                CREATE TRIGGER IF NOT EXISTS blocks_ai AFTER INSERT ON blocks BEGIN
                  INSERT INTO fts_blocks(rowid, content) VALUES (new.rowid, new.content);
                END;
                CREATE TRIGGER IF NOT EXISTS blocks_ad AFTER DELETE ON blocks BEGIN
                  INSERT INTO fts_blocks(fts_blocks, rowid, content) VALUES('delete', old.rowid, old.content);
                END;
                CREATE TRIGGER IF NOT EXISTS blocks_au AFTER UPDATE ON blocks BEGIN
                  INSERT INTO fts_blocks(fts_blocks, rowid, content) VALUES('delete', old.rowid, old.content);
                  INSERT INTO fts_blocks(rowid, content) VALUES (new.rowid, new.content);
                END;
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_assets_and_templates",
            sql: r#"
                -- Assets Table (File Storage)
                CREATE TABLE IF NOT EXISTS assets (
                    id TEXT PRIMARY KEY,
                    page_id TEXT,
                    file_path TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    mime_type TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
                );

                -- Templates Table
                CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    icon TEXT,
                    content JSON NOT NULL,
                    is_builtin INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Index for faster template lookups
                CREATE INDEX IF NOT EXISTS idx_templates_builtin ON templates(is_builtin);
                CREATE INDEX IF NOT EXISTS idx_assets_page_id ON assets(page_id);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_page_cover",
            sql: r#"
                ALTER TABLE pages ADD COLUMN cover TEXT;
            "#,
            kind: MigrationKind::Up,
        },
    ]
}
