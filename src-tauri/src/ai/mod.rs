use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
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

#[derive(Serialize)]
pub struct ChatRequest {
    page_id: String,
    message: String,
}

#[derive(Serialize)]
pub struct AgentRequest {
    page_id: String,
    task: String,
}

pub struct AiSidecarState {
    #[allow(dead_code)]
    process: Mutex<Option<Child>>,
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
            client: Client::new(),
        }
    }
}

pub fn spawn_sidecar(app: &AppHandle) {
    let mut state = app.state::<AiSidecarState>();
    
    // Attempt to spawn the Python process.
    // In a production environment, this would point to a bundled executable.
    // For development, we assume running `python` or `uvicorn` in the `ai-engine` folder.
    #[cfg(debug_assertions)]
    let child = Command::new("python")
        .args(["-m", "uvicorn", "main:app", "--port", "8000"])
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
        .post("http://127.0.0.1:8000/sync/context")
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
) -> Result<String, String> {
    let req = ChatRequest {
        page_id,
        message: prompt,
    };

    let res = state
        .client
        .post("http://127.0.0.1:8000/chat/")
        .json(&req)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
pub async fn agent_task(
    state: State<'_, AiSidecarState>,
    page_id: String,
    task: String,
) -> Result<String, String> {
    let req = AgentRequest {
        page_id,
        task,
    };

    let res = state
        .client
        .post("http://127.0.0.1:8000/agent/")
        .json(&req)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}
