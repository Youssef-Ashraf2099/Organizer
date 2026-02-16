pub mod database;
pub mod ai;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;
use uuid::Uuid;
use ai::{OllamaClient, OpenAIClient, RAGEngine, operations::AIAction, AiConfig, BackendType, ChatMessage};
use std::sync::Mutex;

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

// ==================== AI AGENT COMMANDS ====================

/// Check if Ollama is running and accessible
#[tauri::command]
async fn ai_health_check(state: tauri::State<'_, AiState>) -> Result<bool, String> {
    let cfg = state.config.lock().map_err(|_| "config lock poisoned")?.clone();
    match cfg.backend {
        BackendType::Ollama => {
            let client = OllamaClient::new(Some(cfg.base_url.clone()), cfg.model.clone());
            client.health_check().await.map_err(|e| e.to_string())
        }
        BackendType::OpenAI => {
            let client = OpenAIClient::new(cfg.base_url.clone(), cfg.model.clone(), None);
            client.health_check().await.map_err(|e| e.to_string())
        }
    }
}

/// Get list of available AI models from Ollama
#[tauri::command]
async fn ai_list_models(state: tauri::State<'_, AiState>) -> Result<Vec<String>, String> {
    let cfg = state.config.lock().map_err(|_| "config lock poisoned")?.clone();
    match cfg.backend {
        BackendType::Ollama => {
            let client = OllamaClient::new(Some(cfg.base_url.clone()), cfg.model.clone());
            client.list_models().await.map_err(|e| e.to_string())
        }
        BackendType::OpenAI => {
            let client = OpenAIClient::new(cfg.base_url.clone(), cfg.model.clone(), None);
            client.list_models().await.map_err(|e| e.to_string())
        }
    }
}

/// Get predefined AI actions (slash commands)
#[tauri::command]
fn ai_get_actions() -> Vec<AIAction> {
    AIAction::default_actions()
}

/// Execute an AI action with context
#[tauri::command]
async fn ai_execute_action(
    state: tauri::State<'_, AiState>,
    _page_id: String,
    action_id: String,
    selection: String,
    page_context: Option<String>,
) -> Result<String, String> {
    // Get the action definition
    let actions = AIAction::default_actions();
    let action = actions
        .iter()
        .find(|a| a.id == action_id)
        .ok_or("Action not found")?
        .clone();

    // Build context prompt
    let context = page_context.unwrap_or(selection.clone());
    let rag = RAGEngine::new();
    let prompt = rag
        .build_context_prompt(&selection, &context, &action.system_prompt)
        .map_err(|e| e.to_string())?;

    // Generate response using Ollama
    let cfg = state.config.lock().map_err(|_| "config lock poisoned")?.clone();
    let response = match cfg.backend {
        BackendType::Ollama => {
            let client = OllamaClient::new(Some(cfg.base_url.clone()), cfg.model.clone());
            client.generate(&prompt, Some(0.7), Some(500)).await.map_err(|e| e.to_string())?
        }
        BackendType::OpenAI => {
            let client = OpenAIClient::new(cfg.base_url.clone(), cfg.model.clone(), None);
            client.generate(&prompt, Some(0.7), Some(500)).await.map_err(|e| e.to_string())?
        }
    };

    Ok(response)
}

/// Get AI state (model info, etc)
#[tauri::command]
fn ai_get_state(state: tauri::State<'_, AiState>) -> AiConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn ai_set_state(state: tauri::State<'_, AiState>, backend: BackendType, base_url: String, model: String) -> Result<(), String> {
    let mut cfg = state.config.lock().map_err(|_| "config lock poisoned")?;
    cfg.backend = backend;
    cfg.base_url = base_url;
    cfg.model = model;
    Ok(())
}

/// Chat with AI model (conversational interface)
#[tauri::command]
async fn ai_chat(
    state: tauri::State<'_, AiState>,
    messages: Vec<ChatMessage>,
    model: Option<String>,
    backend: Option<BackendType>,
) -> Result<String, String> {
    let cfg = state.config.lock().map_err(|_| "config lock poisoned")?.clone();
    
    let target_backend = backend.unwrap_or(cfg.backend);
    let target_model = model.unwrap_or(cfg.model);
    
    // Note: We currently reuse the configured base_url. 
    // In the future, we might want to pass base_url override or have separate configs per backend.
    
    match target_backend {
        BackendType::Ollama => {
            let client = OllamaClient::new(Some(cfg.base_url.clone()), target_model);
            client.chat(messages).await.map_err(|e| e.to_string())
        }
        BackendType::OpenAI => {
            let client = OpenAIClient::new(cfg.base_url.clone(), target_model, None);
            client.chat(messages).await.map_err(|e| e.to_string())
        }
    }
}

/// State struct for sharing dependencies across commands
pub struct AiState {
    pub config: Mutex<AiConfig>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(sqlite_url(), database::schema::get_migrations())
                .build(),
        )
        .setup(|app| {
            maybe_migrate_legacy_db(app.handle());
            // Initialize AI state with default configuration
            app.manage(AiState { config: Mutex::new(AiConfig::default()) });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            upload_file,
            upload_asset_bytes,
            get_asset_url,
            delete_asset_file,
            read_asset_file,
            ai_health_check,
            ai_list_models,
            ai_get_actions,
            ai_execute_action,
            ai_get_state,
            ai_set_state,
            ai_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
