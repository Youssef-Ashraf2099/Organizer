pub mod ai;
pub mod database;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;
use rusqlite::Connection;
use database::diagrams::{self, DiagramFolder, DiagramLibrary, DiagramRecord, SaveDiagramInput};

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetInfo {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
}

fn sqlite_url() -> &'static str {
    if cfg!(debug_assertions) {
        "sqlite:omni_workspace_dev.db"
    } else {
        "sqlite:omni_workspace.db"
    }
}

fn sqlite_file_name() -> &'static str {
    if cfg!(debug_assertions) {
        "omni_workspace_dev.db"
    } else {
        "omni_workspace.db"
    }
}

#[tauri::command]
fn reset_local_db(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    let db_name = sqlite_file_name();
    let db_path = app_data_dir.join(db_name);
    let wal_path = app_data_dir.join(format!("{db_name}-wal"));
    let shm_path = app_data_dir.join(format!("{db_name}-shm"));

    if db_path.exists() {
        fs::remove_file(&db_path).map_err(|e| format!("Failed to remove db: {e}"))?;
    }
    if wal_path.exists() {
        fs::remove_file(&wal_path).map_err(|e| format!("Failed to remove wal: {e}"))?;
    }
    if shm_path.exists() {
        fs::remove_file(&shm_path).map_err(|e| format!("Failed to remove shm: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
fn repair_sql_migrations(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    let db_name = sqlite_file_name();
    let db_path = app_data_dir.join(db_name);
    if !db_path.exists() {
        return Ok(());
    }

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open db: {e}"))?;

    let tables = ["__tauri_migrations", "_sqlx_migrations"]; 
    for table in tables {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                [table],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !exists {
            continue;
        }

        let _ = conn.execute(
            &format!("DELETE FROM {table} WHERE version = 1"),
            [],
        );
    }

    Ok(())
}

fn maybe_migrate_legacy_db(app: &tauri::AppHandle) {
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("Failed to get app data directory: {e}");
            return;
        }
    };

    let target_name = sqlite_file_name();
    let legacy_name = "omni_workspace.db";

    if target_name == legacy_name {
        return;
    }

    let target_path = app_data_dir.join(target_name);
    let legacy_path = app_data_dir.join(legacy_name);

    if target_path.exists() || !legacy_path.exists() {
        return;
    }

    if let Err(e) = fs::copy(&legacy_path, &target_path) {
        eprintln!(
            "Failed to migrate legacy database from {} to {}: {e}",
            legacy_path.display(),
            target_path.display()
        );
    }
}

fn collect_startup_markdown_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter_map(|arg| {
            let path = Path::new(&arg);
            let extension = path
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase());

            let is_markdown = matches!(extension.as_deref(), Some("md") | Some("markdown"));
            if is_markdown && path.is_file() {
                Some(path.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect()
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub struct StartupFileState {
    pub markdown_files: Mutex<Vec<String>>,
}

#[tauri::command]
fn get_launch_markdown_files(state: tauri::State<'_, StartupFileState>) -> Vec<String> {
    let mut files = state.markdown_files.lock().unwrap();
    std::mem::take(&mut *files)
}

#[tauri::command]
fn read_markdown_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.exists() || !path.is_file() {
        return Err("Markdown file does not exist".to_string());
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    if !matches!(extension.as_deref(), Some("md") | Some("markdown")) {
        return Err("Only markdown files are supported".to_string());
    }

    fs::read_to_string(path).map_err(|e| format!("Failed to read markdown file: {e}"))
}

#[tauri::command]
async fn upload_file(
    app: tauri::AppHandle,
    file_path: String,
    _page_id: Option<String>,
) -> Result<AssetInfo, String> {
    let source_path = Path::new(&file_path);
    
    if !source_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    // Get app data directory
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let assets_dir = app_data_dir.join("assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    // Generate unique filename
    let file_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?;
    
    let file_ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    
    let asset_id = Uuid::new_v4().to_string();
    let new_file_name = format!("{}.{}", asset_id, file_ext);
    let dest_path = assets_dir.join(&new_file_name);

    // Copy file
    fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Get file metadata
    let metadata = fs::metadata(&dest_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    
    let file_size = metadata.len() as i64;
    
    // Determine file type and mime type
    let file_type = if file_ext.is_empty() {
        "unknown".to_string()
    } else {
        file_ext.to_lowercase()
    };
    
    let mime_type = match file_ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "png" => Some("image/png".to_string()),
        "gif" => Some("image/gif".to_string()),
        "webp" => Some("image/webp".to_string()),
        "mp4" => Some("video/mp4".to_string()),
        "webm" => Some("video/webm".to_string()),
        "pdf" => Some("application/pdf".to_string()),
        _ => None,
    };

    // Return asset info - frontend will handle database insert
    let relative_path = format!("assets/{}", new_file_name);

    Ok(AssetInfo {
        id: asset_id,
        file_path: relative_path,
        file_name: file_name.to_string(),
        file_type,
        file_size,
        mime_type,
    })
}

#[tauri::command]
async fn upload_asset_bytes(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    file_name: String,
    extension: String,
    _page_id: Option<String>,
) -> Result<AssetInfo, String> {
    // Get app data directory
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let assets_dir = app_data_dir.join("assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    let asset_id = Uuid::new_v4().to_string();
    let new_file_name = if extension.is_empty() {
        asset_id.clone()
    } else {
        format!("{}.{}", asset_id, extension)
    };
    let dest_path = assets_dir.join(&new_file_name);

    // Save bytes to disk
    fs::write(&dest_path, bytes)
        .map_err(|e| format!("Failed to save asset: {}", e))?;

    // Get file info
    let file_size = fs::metadata(&dest_path)
        .map_err(|e| format!("Failed to get metadata: {}", e))?
        .len() as i64;
    
    let file_type = extension.to_lowercase();
    let mime_type = match file_type.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "png" => Some("image/png".to_string()),
        "gif" => Some("image/gif".to_string()),
        "webp" => Some("image/webp".to_string()),
        "mp4" => Some("video/mp4".to_string()),
        "webm" => Some("video/webm".to_string()),
        "pdf" => Some("application/pdf".to_string()),
        _ => None,
    };

    let relative_path = format!("assets/{}", new_file_name);

    Ok(AssetInfo {
        id: asset_id,
        file_path: relative_path,
        file_name,
        file_type,
        file_size,
        mime_type,
    })
}

#[tauri::command]
async fn get_asset_url(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let full_path = app_data_dir.join(&file_path);
    
    // Convert to file:// URL for display
    let url = format!("file:///{}", full_path.to_string_lossy().replace('\\', "/"));
    
    Ok(url)
}

#[tauri::command]
async fn read_asset_file(app: tauri::AppHandle, file_path: String) -> Result<Vec<u8>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let full_path = app_data_dir.join(&file_path);
    
    // Read file as bytes
    let bytes = fs::read(&full_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    Ok(bytes)
}

#[tauri::command]
fn diagram_get_library(app: tauri::AppHandle) -> Result<DiagramLibrary, String> {
    diagrams::get_library(app)
}

#[tauri::command]
fn diagram_create_folder(app: tauri::AppHandle, name: String) -> Result<DiagramFolder, String> {
    diagrams::create_folder(app, name)
}

#[tauri::command]
fn diagram_rename_folder(app: tauri::AppHandle, folder_id: String, name: String) -> Result<(), String> {
    diagrams::rename_folder(app, folder_id, name)
}

#[tauri::command]
fn diagram_delete_folder(app: tauri::AppHandle, folder_id: String) -> Result<(), String> {
    diagrams::delete_folder(app, folder_id)
}

#[tauri::command]
fn diagram_save(app: tauri::AppHandle, input: SaveDiagramInput) -> Result<DiagramRecord, String> {
    diagrams::save_diagram(app, input)
}

#[tauri::command]
fn diagram_delete(app: tauri::AppHandle, diagram_id: String) -> Result<(), String> {
    diagrams::delete_diagram(app, diagram_id)
}

#[tauri::command]
async fn delete_asset_file(app: tauri::AppHandle, file_path: String) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let full_path = app_data_dir.join(&file_path);
    
    // Delete file
    if full_path.exists() {
        fs::remove_file(&full_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(sqlite_url(), database::schema::get_migrations())
                .build(),
        )
        .setup(|app| {
            app.manage(ai::AiSidecarState::default());

            maybe_migrate_legacy_db(app.handle());
            let startup_markdown_files = collect_startup_markdown_files();
            app.manage(StartupFileState {
                markdown_files: Mutex::new(startup_markdown_files),
            });

            Ok(())
        })
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::Destroyed => {
                // When the main window is destroyed, we could potentially kill the sidecar
                // However, doing it on exit is better, which can be done in main.rs or a plugin
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_launch_markdown_files,
            read_markdown_file,
            reset_local_db,
            repair_sql_migrations,
            upload_file,
            upload_asset_bytes,
            get_asset_url,
            delete_asset_file,
            read_asset_file,
            diagram_get_library,
            diagram_create_folder,
            diagram_rename_folder,
            diagram_delete_folder,
            diagram_save,
            diagram_delete,
            ai::sync_page_context,
            ai::ask_ai,
            ai::agent_task,
            ai::ai_health,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
