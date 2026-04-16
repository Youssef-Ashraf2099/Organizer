use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiagramRecord {
    pub id: String,
    pub folder_id: String,
    pub name: String,
    pub source_type: String,
    pub template_key: Option<String>,
    pub code: String,
    pub svg_markup: Option<String>,
    pub theme_preset: Option<String>,
    pub sort_order: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiagramFolder {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub diagrams: Vec<DiagramRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiagramLibrary {
    pub folders: Vec<DiagramFolder>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveDiagramInput {
    pub id: Option<String>,
    pub folder_id: String,
    pub name: String,
    pub source_type: String,
    pub template_key: Option<String>,
    pub code: String,
    pub svg_markup: Option<String>,
    pub theme_preset: Option<String>,
    pub sort_order: Option<i64>,
}

fn sqlite_file_name() -> &'static str {
    if cfg!(debug_assertions) {
        "omni_workspace_dev.db"
    } else {
        "omni_workspace.db"
    }
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_data_dir.join(sqlite_file_name()))
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let connection = Connection::open(path)
        .map_err(|e| format!("Failed to open diagram database: {e}"))?;
    ensure_schema(&connection)?;
    ensure_seed_data(&connection)?;
    Ok(connection)
}

fn ensure_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS diagram_folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS diagrams (
                id TEXT PRIMARY KEY,
                folder_id TEXT NOT NULL,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'mermaid',
                template_key TEXT,
                code TEXT NOT NULL,
                svg_markup TEXT,
                theme_preset TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (folder_id) REFERENCES diagram_folders(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_diagram_folders_sort_order ON diagram_folders(sort_order);
            CREATE INDEX IF NOT EXISTS idx_diagrams_folder_id ON diagrams(folder_id);
            CREATE INDEX IF NOT EXISTS idx_diagrams_sort_order ON diagrams(sort_order);
            "#,
        )
        .map_err(|e| format!("Failed to initialize diagram schema: {e}"))
}

fn ensure_seed_data(connection: &Connection) -> Result<(), String> {
    let folder_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM diagram_folders", [], |row| row.get(0))
        .map_err(|e| format!("Failed to inspect diagram folders: {e}"))?;

    if folder_count > 0 {
        return Ok(());
    }

    let defaults = [
        ("Architecture", 0_i64),
        ("Data Models", 1_i64),
        ("Flows", 2_i64),
        ("Archive", 3_i64),
    ];

    for (name, sort_order) in defaults {
        let folder_id = Uuid::new_v4().to_string();
        connection
            .execute(
                "INSERT INTO diagram_folders (id, name, sort_order) VALUES (?1, ?2, ?3)",
                params![folder_id, name, sort_order],
            )
            .map_err(|e| format!("Failed to seed diagram folder: {e}"))?;
    }

    Ok(())
}

fn read_diagram_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<DiagramRecord> {
    Ok(DiagramRecord {
        id: row.get("id")?,
        folder_id: row.get("folder_id")?,
        name: row.get("name")?,
        source_type: row.get("source_type")?,
        template_key: row.get("template_key")?,
        code: row.get("code")?,
        svg_markup: row.get("svg_markup")?,
        theme_preset: row.get("theme_preset")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn get_library(app: AppHandle) -> Result<DiagramLibrary, String> {
    let connection = open_connection(&app)?;

    let mut folder_statement = connection
        .prepare(
            r#"
            SELECT id, name, sort_order
            FROM diagram_folders
            ORDER BY sort_order ASC, created_at ASC
            "#,
        )
        .map_err(|e| format!("Failed to query diagram folders: {e}"))?;

    let folder_rows = folder_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to read diagram folders: {e}"))?;

    let mut folders = Vec::new();

    for folder_row in folder_rows {
        let (folder_id, name, sort_order) =
            folder_row.map_err(|e| format!("Failed to parse diagram folder: {e}"))?;

        let mut diagram_statement = connection
            .prepare(
                r#"
                SELECT id, folder_id, name, source_type, template_key, code, svg_markup,
                       theme_preset, sort_order, created_at, updated_at
                FROM diagrams
                WHERE folder_id = ?1
                ORDER BY sort_order ASC, created_at ASC
                "#,
            )
            .map_err(|e| format!("Failed to query folder diagrams: {e}"))?;

        let diagrams = diagram_statement
            .query_map(params![&folder_id], read_diagram_record)
            .map_err(|e| format!("Failed to read folder diagrams: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to parse folder diagrams: {e}"))?;

        folders.push(DiagramFolder {
            id: folder_id,
            name,
            sort_order,
            diagrams,
        });
    }

    Ok(DiagramLibrary { folders })
}

pub fn create_folder(app: AppHandle, name: String) -> Result<DiagramFolder, String> {
    let connection = open_connection(&app)?;
    let next_sort_order: i64 = connection
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM diagram_folders",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to compute folder order: {e}"))?;

    let folder_id = Uuid::new_v4().to_string();
    connection
        .execute(
            "INSERT INTO diagram_folders (id, name, sort_order) VALUES (?1, ?2, ?3)",
            params![&folder_id, name, next_sort_order],
        )
        .map_err(|e| format!("Failed to create diagram folder: {e}"))?;

    Ok(DiagramFolder {
        id: folder_id,
        name,
        sort_order: next_sort_order,
        diagrams: Vec::new(),
    })
}

pub fn rename_folder(app: AppHandle, folder_id: String, name: String) -> Result<(), String> {
    let connection = open_connection(&app)?;
    connection
        .execute(
            "UPDATE diagram_folders SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![name, folder_id],
        )
        .map_err(|e| format!("Failed to rename diagram folder: {e}"))?;
    Ok(())
}

pub fn delete_folder(app: AppHandle, folder_id: String) -> Result<(), String> {
    let connection = open_connection(&app)?;
    connection
        .execute("DELETE FROM diagram_folders WHERE id = ?1", params![folder_id])
        .map_err(|e| format!("Failed to delete diagram folder: {e}"))?;
    Ok(())
}

pub fn save_diagram(app: AppHandle, input: SaveDiagramInput) -> Result<DiagramRecord, String> {
    let connection = open_connection(&app)?;
    let diagram_id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let sort_order = input.sort_order.unwrap_or_else(|| {
        connection
            .query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM diagrams WHERE folder_id = ?1",
                params![&input.folder_id],
                |row| row.get(0),
            )
            .unwrap_or(0)
    });

    connection
        .execute(
            r#"
            INSERT INTO diagrams (
                id, folder_id, name, source_type, template_key, code, svg_markup, theme_preset, sort_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
                folder_id = excluded.folder_id,
                name = excluded.name,
                source_type = excluded.source_type,
                template_key = excluded.template_key,
                code = excluded.code,
                svg_markup = excluded.svg_markup,
                theme_preset = excluded.theme_preset,
                sort_order = excluded.sort_order,
                updated_at = CURRENT_TIMESTAMP
            "#,
            params![
                &diagram_id,
                &input.folder_id,
                &input.name,
                &input.source_type,
                &input.template_key,
                &input.code,
                &input.svg_markup,
                &input.theme_preset,
                &sort_order,
            ],
        )
        .map_err(|e| format!("Failed to save diagram: {e}"))?;

    get_diagram(&connection, &diagram_id)
        .ok_or_else(|| "Failed to reload saved diagram".to_string())
}

fn get_diagram(connection: &Connection, diagram_id: &str) -> Option<DiagramRecord> {
    connection
        .query_row(
            r#"
            SELECT id, folder_id, name, source_type, template_key, code, svg_markup,
                   theme_preset, sort_order, created_at, updated_at
            FROM diagrams
            WHERE id = ?1
            "#,
            params![diagram_id],
            read_diagram_record,
        )
        .optional()
        .ok()
        .flatten()
}

pub fn delete_diagram(app: AppHandle, diagram_id: String) -> Result<(), String> {
    let connection = open_connection(&app)?;
    connection
        .execute("DELETE FROM diagrams WHERE id = ?1", params![diagram_id])
        .map_err(|e| format!("Failed to delete diagram: {e}"))?;
    Ok(())
}