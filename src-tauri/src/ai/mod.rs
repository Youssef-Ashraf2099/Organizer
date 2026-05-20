use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use std::env;
use std::net::TcpListener;
use std::process::{Child, Command};
use std::sync::Mutex;
use reqwest::Client;

#[derive(Serialize)]
pub struct SyncContextRequest {
    page_id: String,
    content: String,
    #[serde(rename = "type")]
    content_type: String,
}

#[derive(Deserialize, Serialize)]
pub struct ChatHistoryMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
pub struct ChatRequest {
    page_id: String,
    message: String,
    history: Vec<ChatHistoryMessage>,
    page_content: String,
    allow_tools: bool,
}

#[derive(Serialize)]
pub struct AgentRequest {
    page_id: String,
    task: String,
    page_content: String,
}

pub struct AiSidecarState {
    #[allow(dead_code)]
    process: Mutex<Option<Child>>,
    base_url: Mutex<String>,
    client: Client,
}

impl Drop for AiSidecarState {
    fn drop(&mut self) {
        if let Ok(mut p) = self.process.lock() {
            if let Some(mut child) = p.take() {
                let _ = child.kill();
                println!("Killed Python AI Engine Sidecar on exit.");
            }
        }
    }
}

impl Default for AiSidecarState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            base_url: Mutex::new("http://127.0.0.1:8000".to_string()),
            client: Client::new(),
        }
    }
}

fn pick_available_port() -> u16 {
    const DEFAULT_PORTS: [u16; 3] = [8000, 8001, 8002];
    if let Ok(value) = env::var("AI_PORT") {
        if let Ok(port) = value.parse::<u16>() {
            return port;
        }
    }

    for port in DEFAULT_PORTS {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }

    8000
}

fn get_base_url(state: &AiSidecarState) -> String {
    state
        .base_url
        .lock()
        .map(|url| url.clone())
        .unwrap_or_else(|_| "http://127.0.0.1:8000".to_string())
}

pub fn spawn_sidecar(app: &AppHandle) {
    let state = app.state::<AiSidecarState>();
    let port = pick_available_port();
    if let Ok(mut url) = state.base_url.lock() {
        *url = format!("http://127.0.0.1:{}", port);
    }
    
    // Attempt to spawn the Python process.
    // In a production environment, this would point to a bundled executable.
    // For development, we assume running `python` or `uvicorn` in the `ai-engine` folder.
    #[cfg(debug_assertions)]
    let child = Command::new("python")
        .args([
            "-m",
            "uvicorn",
            "main:app",
            "--port",
            &port.to_string(),
        ])
        .current_dir("../ai-engine")
        .spawn();

    #[cfg(not(debug_assertions))]
    let child = Command::new("ai-engine-binary") // Placeholder for production binary
        .spawn();

    match child {
        Ok(process) => {
            let mut p = state.process.lock().unwrap();
            *p = Some(process);
            println!("Started Python AI Engine Sidecar.");
        }
        Err(e) => {
            eprintln!("Failed to start AI Engine Sidecar: {}", e);
        }
    }
}

pub fn kill_sidecar(app: &AppHandle) {
    let state = app.state::<AiSidecarState>();
    let mut p = state.process.lock().unwrap();
    if let Some(mut child) = p.take() {
        let _ = child.kill();
        println!("Killed Python AI Engine Sidecar.");
    }
}

#[tauri::command]
pub async fn sync_page_context(
    state: State<'_, AiSidecarState>,
    page_id: String,
    content: String,
) -> Result<String, String> {
    let req = SyncContextRequest {
        page_id,
        content,
        content_type: "markdown".to_string(),
    };

    let res = state
        .client
        .post(format!("{}/sync/context", get_base_url(&state)))
        .json(&req)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
pub async fn ask_ai(
    state: State<'_, AiSidecarState>,
    page_id: String,
    prompt: String,
    history: Vec<ChatHistoryMessage>,
    page_content: String,
    allow_tools: bool,
) -> Result<String, String> {
    let req = ChatRequest {
        page_id,
        message: prompt,
        history,
        page_content,
        allow_tools,
    };

    let res = state
        .client
        .post(format!("{}/chat/", get_base_url(&state)))
        .json(&req)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
pub async fn agent_task(
    app: AppHandle,
    state: State<'_, AiSidecarState>,
    page_id: String,
    task: String,
    page_content: String,
) -> Result<String, String> {
    let req = AgentRequest {
        page_id,
        task,
        page_content,
    };

    let res = state
        .client
        .post(format!("{}/agent/", get_base_url(&state)))
        .json(&req)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    
    // Parse the response to see if there's a tool command in the draft
    if let Ok(json_response) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Some(draft) = json_response.get("draft").and_then(|d| d.as_str()) {
            // Check if the draft itself is a tool command JSON
            if draft.trim().starts_with('{') {
                if let Ok(tool_command) = serde_json::from_str::<serde_json::Value>(draft) {
                    if tool_command.get("action").is_some() {
                        let _ = app.emit("aiToolCommand", tool_command);
                    }
                }
            }
        }
    }
    
    Ok(text)
}

#[tauri::command]
pub async fn ai_health(state: State<'_, AiSidecarState>) -> Result<String, String> {
    let res = state
        .client
        .get(format!("{}/health", get_base_url(&state)))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}
