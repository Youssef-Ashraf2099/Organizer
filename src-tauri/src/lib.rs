pub mod database;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetInfo {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:omni_workspace.db", database::schema::get_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            upload_file,
            get_asset_url,
            delete_asset_file,
            read_asset_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
