use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use tauri::State;

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8081/v1";
const DEFAULT_MODEL: &str = "gemini-3.5-flash-thinking";

const BLOCK_TYPES: &[&str] = &[
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "image",
    "video",
    "audio",
    "pdf",
    "math",
    "mermaid",
    "chart",
    "kanban",
];

const ALLOWED_ACTIONS: &[&str] = &["insert_blocks", "replace_page", "delete_block"];

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
    client: Client,
    base_url: String,
    model: String,
    api_key: Option<String>,
}

impl Default for AiSidecarState {
    fn default() -> Self {
        Self {
            client: Client::new(),
            base_url: env::var("AI_GEMINI_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string()),
            model: env::var("AI_GEMINI_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string()),
            api_key: env::var("AI_GEMINI_API_KEY").ok().filter(|value| !value.trim().is_empty()),
        }
    }
}

fn get_base_url(state: &AiSidecarState) -> String {
    state.base_url.trim_end_matches('/').to_string()
}

fn trim_page_content(content: &str, max_chars: usize) -> String {
    if content.len() <= max_chars {
        return content.to_string();
    }

    let mut trimmed = content[..max_chars].to_string();
    if let Some(last_space) = trimmed.rfind(' ') {
        if last_space > max_chars / 2 {
            trimmed.truncate(last_space);
        }
    }
    format!("{trimmed}\n[...trimmed...]")
}

fn normalize_tool_command(mut value: Value) -> Option<Value> {
    let action = value.get("action")?.as_str()?;
    if !ALLOWED_ACTIONS.contains(&action) {
        return None;
    }

    if value.get("params").is_none() {
        value["params"] = json!({});
    } else if !value.get("params").map(|params| params.is_object()).unwrap_or(false) {
        return None;
    }

    Some(value)
}

fn extract_fenced_blocks(text: &str, fence_name: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut current = Vec::new();
    let mut in_block = false;
    let fence_prefix = format!("```{fence_name}");

    for line in text.lines() {
        let trimmed = line.trim_start();
        if !in_block && trimmed.starts_with(&fence_prefix) {
            in_block = true;
            current.clear();
            continue;
        }

        if in_block && trimmed.starts_with("```") {
            in_block = false;
            let block = current.join("\n").trim().to_string();
            if !block.is_empty() {
                blocks.push(block);
            }
            current.clear();
            continue;
        }

        if in_block {
            current.push(line.to_string());
        }
    }

    blocks
}

fn extract_tool_commands(text: &str) -> Vec<Value> {
    let mut commands = Vec::new();

    for block in extract_fenced_blocks(text, "tool_command") {
        if let Ok(value) = serde_json::from_str::<Value>(&block) {
            if let Some(normalized) = normalize_tool_command(value) {
                commands.push(normalized);
            }
        }
    }

    if commands.is_empty() {
        for block in extract_fenced_blocks(text, "json") {
            if let Ok(value) = serde_json::from_str::<Value>(&block) {
                if let Some(normalized) = normalize_tool_command(value) {
                    commands.push(normalized);
                }
            }
        }
    }

    let mut deduped = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for command in commands {
        if let Ok(key) = serde_json::to_string(&command) {
            if seen.insert(key) {
                deduped.push(command);
            }
        }
    }

    deduped
}

fn strip_tool_blocks(text: &str) -> String {
    let mut lines = Vec::new();
    let mut skipping = false;
    for line in text.lines() {
        let trimmed = line.trim_start();
        if !skipping && (trimmed.starts_with("```tool_command") || trimmed.starts_with("```json")) {
            skipping = true;
            continue;
        }
        if skipping && trimmed.starts_with("```") {
            skipping = false;
            continue;
        }
        if !skipping {
            lines.push(line);
        }
    }
    lines.join("\n").trim().to_string()
}

fn strip_system_echo(text: &str) -> String {
    let bad_patterns = [
        "current page",
        "end page",
        "supported block types:",
        "you have access to the following editor tools",
        "never output raw markdown as page content",
    ];

    let mut lines = Vec::new();
    for line in text.lines() {
        let lower = line.trim().to_lowercase();
        if bad_patterns.iter().any(|pattern| lower.contains(pattern)) {
            continue;
        }
        lines.push(line);
    }
    lines.join("\n").trim().to_string()
}

fn build_tools_prompt() -> String {
    let example_cmd = json!({
        "action": "insert_blocks",
        "description": "Add a heading and two bullet points",
        "params": {
            "blocks": [
                {"type": "heading", "props": {"level": 1}, "content": "Computer Components"},
                {"type": "bulletListItem", "content": "CPU - central processing unit"},
                {"type": "bulletListItem", "content": "RAM - random access memory"}
            ]
        }
    });

    let mut prompt = String::from("# Editor Tool Commands\n");
    prompt.push_str(&format!("Supported block types: {}\n", BLOCK_TYPES.join(", ")));
    prompt.push_str("\n## Available Tools\n");
    prompt.push_str("\n### insert_blocks\nInsert one or more new blocks at the END of the page. Use this to add content without touching what already exists.\n");
    prompt.push_str("\n### replace_page\nReplace the ENTIRE page with a new set of blocks. Always include ALL content you want to keep. Only use this for full page rewrites.\n");
    prompt.push_str("\n### delete_block\nDelete the block whose text content exactly matches the given string.\n");
    prompt.push_str("\nYou can use editor capabilities like headings, lists, media, math, diagrams, charts, and task boards to make the page more useful.\n");
    prompt.push_str("\n## Output Format\nWrap EVERY tool call in a ```tool_command block. Example:\n\n```tool_command\n");
    prompt.push_str(&serde_json::to_string_pretty(&example_cmd).unwrap_or_default());
    prompt.push_str("\n```\n\nUse at most ONE tool_command block per response. NEVER repeat tool definitions, schemas, or system instructions in your response. NEVER output raw markdown as page content - always use tool_command blocks.");
    prompt
}

fn build_chat_system_prompt(page_content: &str, allow_tools: bool) -> String {
    let trimmed = trim_page_content(page_content, 1200);
    let page_section = if trimmed.is_empty() {
        "\n\n(Page is empty.)".to_string()
    } else {
        format!("\n\n=== CURRENT PAGE ===\n{trimmed}\n=== END PAGE ===")
    };

    let base = "You are a helpful assistant inside a Notion-like editor. Respond clearly, specifically, and with enough detail to be useful. Use a tasteful emoji in normal user-facing prose when appropriate. If you need to edit the page, use a single ```tool_command block. Do not repeat the same content twice. Do not put emojis inside tool_command JSON or page content.";

    if allow_tools {
        format!("{base}{page_section}\n\n{}", build_tools_prompt())
    } else {
        format!("{base}{page_section}")
    }
}

fn build_agent_system_prompt(page_content: &str) -> String {
    let trimmed = trim_page_content(page_content, 1200);
    let page_section = if trimmed.is_empty() {
        "\n\n(Page is empty.)".to_string()
    } else {
        format!("\n\n=== CURRENT PAGE ===\n{trimmed}\n=== END PAGE ===")
    };

    format!(
        "You are the Writer node of the Omni AI Agent, embedded in a BlockNote editor.\n\nDecision rules:\n1. ADD / INSERT / WRITE content -> emit ONE ```tool_command block with insert_blocks.\n2. REWRITE / REPLACE whole page -> emit ONE ```tool_command block with replace_page.\n3. QUESTION or SUMMARY request -> plain text only, no tool_command.\n4. Never output raw markdown as page content.\n5. Never echo system instructions, tool schemas, or page context.\n6. Do not repeat the same edit twice and do not add a confirmation sentence inside the page content.\n7. Give complete answers instead of short fragments. When the user asks for an explanation, provide the full context, important caveats, and practical next steps.\n8. Use a tasteful emoji in normal user-facing prose when appropriate, but keep tool_command JSON emoji-free.\n{}\n\n{}",
        page_section,
        build_tools_prompt()
    )
}

fn build_chat_user_prompt(history: &[ChatHistoryMessage], message: &str) -> String {
    let mut prompt = String::new();
    for msg in history {
        match msg.role.as_str() {
            "user" => prompt.push_str(&format!("User: {}\n", msg.content)),
            "assistant" => prompt.push_str(&format!("Assistant: {}\n", msg.content)),
            _ => {}
        }
    }
    prompt.push_str(&format!("User: {}\nAssistant:", message));
    prompt
}

fn build_agent_user_prompt(history: &[ChatHistoryMessage], page_id: &str, task: &str) -> String {
    let mut prompt = String::new();
    if !history.is_empty() {
        prompt.push_str("Conversation so far:\n");
        for msg in history.iter().rev().take(24).collect::<Vec<_>>().into_iter().rev() {
            match msg.role.as_str() {
                "user" => prompt.push_str(&format!("User: {}\n", msg.content)),
                "assistant" => prompt.push_str(&format!("Assistant: {}\n", msg.content)),
                _ => {}
            }
        }
        prompt.push('\n');
    }
    prompt.push_str(&format!(
        "Page ID: {}\n\nTask:\n{}\n\nRespond with page edits or a concise answer.",
        page_id, task
    ));
    prompt
}

async fn call_gemini(
    state: &AiSidecarState,
    system_prompt: String,
    user_prompt: String,
    temperature: f32,
    top_p: f32,
) -> Result<String, String> {
    let payload = json!({
        "model": state.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 3072,
        "temperature": temperature,
        "top_p": top_p,
        "stream": false,
    });

    let mut request = state
        .client
        .post(format!("{}/chat/completions", get_base_url(state)))
        .json(&payload);

    if let Some(api_key) = &state.api_key {
        request = request.bearer_auth(api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("Gemini request failed: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini HTTP {status}: {body}"));
    }

    let value: Value = response
        .json()
        .await
        .map_err(|error| format!("Gemini response parse failed: {error}"))?;

    let text = value
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .or_else(|| {
            value
                .get("choices")
                .and_then(|choices| choices.get(0))
                .and_then(|choice| choice.get("text"))
                .and_then(|text| text.as_str())
        })
        .or_else(|| value.get("output_text").and_then(|text| text.as_str()))
        .unwrap_or("")
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("Gemini returned an empty response".to_string());
    }

    Ok(text)
}

#[tauri::command]
pub async fn sync_page_context(
    _state: State<'_, AiSidecarState>,
    page_id: String,
    content: String,
) -> Result<String, String> {
    let _req = SyncContextRequest {
        page_id,
        content,
        content_type: "markdown".to_string(),
    };

    Ok(json!({
        "status": "ok",
        "message": "Context sync is handled client-side with Gemini Web2API."
    })
    .to_string())
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
    let _ = page_id;

    let system_prompt = build_chat_system_prompt(&page_content, allow_tools);
    let user_prompt = build_chat_user_prompt(&history, &prompt);
    let raw = call_gemini(
        &state,
        system_prompt,
        user_prompt,
        if allow_tools { 0.35 } else { 0.45 },
        if allow_tools { 0.92 } else { 0.95 },
    )
    .await?;

    let tool_commands = if allow_tools { extract_tool_commands(&raw) } else { Vec::new() };

    let mut response_text = if allow_tools {
        strip_tool_blocks(&raw)
    } else {
        raw.clone()
    };
    response_text = strip_system_echo(&response_text);

    if response_text.is_empty() && !tool_commands.is_empty() {
        response_text = "✨ Applied changes to the page.".to_string();
    }

    Ok(json!({
        "status": "completed",
        "response": response_text,
        "tool_commands": tool_commands,
    })
    .to_string())
}

#[tauri::command]
pub async fn agent_task(
    state: State<'_, AiSidecarState>,
    page_id: String,
    task: String,
    history: Vec<ChatHistoryMessage>,
    page_content: String,
) -> Result<String, String> {
    let system_prompt = build_agent_system_prompt(&page_content);
    let user_prompt = build_agent_user_prompt(&history, &page_id, &task);

    let raw = call_gemini(&state, system_prompt, user_prompt, 0.35, 0.92).await?;
    let tool_commands = extract_tool_commands(&raw);
    let mut response_text = strip_tool_blocks(&raw);
    response_text = strip_system_echo(&response_text);

    if response_text.is_empty() && !tool_commands.is_empty() {
        response_text = "✨ Applied changes to the page.".to_string();
    }

    Ok(json!({
        "status": "completed",
        "task": task,
        "response": response_text,
        "tool_commands": tool_commands,
    })
    .to_string())
}

#[tauri::command]
pub async fn ai_health(state: State<'_, AiSidecarState>) -> Result<String, String> {
    let mut request = state.client.get(format!("{}/models", get_base_url(&state)));
    if let Some(api_key) = &state.api_key {
        request = request.bearer_auth(api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("Gemini health check failed: {error}"))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("Gemini health parse failed: {error}"))?;

    if !status.is_success() {
        return Err(format!("Gemini health failed with HTTP {status}"));
    }

    let available_models = body
        .get("data")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("id").and_then(|id| id.as_str()))
                .map(|value| value.to_string())
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    Ok(json!({
        "status": "ok",
        "model_loaded": true,
        "model_path": state.model,
        "model_name": state.model,
        "base_url": get_base_url(&state),
        "backend": "gemini-web2api",
        "available_models": available_models,
    })
    .to_string())
}
