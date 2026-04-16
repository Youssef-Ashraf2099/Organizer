use serde::{Deserialize, Serialize};
use thiserror::Error;
use super::ChatMessage;

#[derive(Error, Debug)]
pub enum OpenAIError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),
    #[error("API error: {0}")]
    ApiError(String),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
}

pub type OpenAIResult<T> = Result<T, OpenAIError>;

#[derive(Debug, Clone)]
pub struct OpenAIClient {
    pub base_url: String, // e.g. http://localhost:1234
    pub api_key: Option<String>, // optional for local servers
    pub model: String,
    client: reqwest::Client,
}

impl OpenAIClient {
    pub fn new(base_url: String, model: String, api_key: Option<String>) -> Self {
        Self {
            base_url,
            api_key,
            model,
            client: reqwest::Client::new(),
        }
    }

    pub async fn health_check(&self) -> OpenAIResult<bool> {
        let url = format!("{}/v1/models", self.base_url);
        let mut req = self.client.get(url);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
        let resp = req.send().await?;
        Ok(resp.status().is_success())
    }

    pub async fn list_models(&self) -> OpenAIResult<Vec<String>> {
        #[derive(Deserialize)]
        struct ModelsResp { data: Vec<ModelItem> }
        #[derive(Deserialize)]
        struct ModelItem { id: String }

        let url = format!("{}/v1/models", self.base_url);
        let mut req = self.client.get(url);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(OpenAIError::ApiError(format!("status {}", resp.status())));
        }
        let models: ModelsResp = resp.json().await?;
        Ok(models.data.into_iter().map(|m| m.id).collect())
    }

    /// Non-streaming chat completion
    pub async fn generate(&self, prompt: &str, temperature: Option<f32>, max_tokens: Option<u32>) -> OpenAIResult<String> {
        #[derive(Serialize)]
        struct ChatReq<'a> {
            model: &'a str,
            messages: Vec<serde_json::Value>,
            stream: bool,
            #[serde(skip_serializing_if = "Option::is_none")] temperature: Option<f32>,
            #[serde(skip_serializing_if = "Option::is_none")] max_tokens: Option<u32>,
        }
        #[derive(Deserialize)]
        struct ChatResp { choices: Vec<Choice> }
        #[derive(Deserialize)]
        struct Choice { message: Message }
        #[derive(Deserialize)]
        struct Message { content: String }

        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = ChatReq {
            model: &self.model,
            messages: vec![serde_json::json!({"role":"user","content": prompt})],
            stream: false,
            temperature,
            max_tokens,
        };
        
        println!("Sending OpenAI request to: {}", url);
        if let Ok(json_body) = serde_json::to_string_pretty(&body) {
            println!("Request body:\n{}", json_body);
        }

        let mut req = self.client.post(url).json(&body);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
        let resp = req.send().await?;
        let status = resp.status();
        if !status.is_success() {
            let error_text = resp.text().await.unwrap_or_else(|_| "Could not read error body".to_string());
            println!("OpenAI error body: {}", error_text);
            return Err(OpenAIError::ApiError(format!("status {}: {}", status, error_text)));
        }
        let body_text = resp.text().await?;
        let parsed: ChatResp = serde_json::from_str(&body_text)
            .map_err(|e| OpenAIError::ApiError(format!("invalid JSON response: {} | body: {}", e, body_text)))?;
        let text = parsed.choices.get(0).map(|c| c.message.content.clone()).unwrap_or_default();
        Ok(text)
    }
    /// Chat completion with history
    pub async fn chat(&self, messages: Vec<ChatMessage>) -> OpenAIResult<String> {
        #[derive(Serialize)]
        struct ChatReq<'a> {
            model: &'a str,
            messages: Vec<ChatMessage>,
            stream: bool,
            #[serde(skip_serializing_if = "Option::is_none")] temperature: Option<f32>,
        }
        #[derive(Deserialize)]
        struct ChatResp { choices: Vec<Choice> }
        #[derive(Deserialize)]
        struct Choice { message: Message }
        #[derive(Deserialize)]
        struct Message { content: String }

        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = ChatReq {
            model: &self.model,
            messages,
            stream: false,
            temperature: Some(0.7),
        };
        
        let mut req = self.client.post(url).json(&body);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
        let resp = req.send().await?;
        if !resp.status().is_success() {
             return Err(OpenAIError::ApiError(format!("status {}", resp.status())));
        }
        let body_text = resp.text().await?;
        let parsed: ChatResp = serde_json::from_str(&body_text)
            .map_err(|e| OpenAIError::ApiError(format!("invalid JSON response: {} | body: {}", e, body_text)))?;
        let text = parsed.choices.get(0).map(|c| c.message.content.clone()).unwrap_or_default();
        Ok(text)
    }

    /// Streaming chat completion
    pub async fn chat_stream<F>(&self, messages: Vec<ChatMessage>, mut on_chunk: F) -> OpenAIResult<()> 
    where F: FnMut(String) + Send + 'static
    {
        #[derive(Serialize)]
        struct ChatReq<'a> {
            model: &'a str,
            messages: Vec<ChatMessage>,
            stream: bool,
            #[serde(skip_serializing_if = "Option::is_none")] temperature: Option<f32>,
        }
        
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = ChatReq {
            model: &self.model,
            messages,
            stream: true, // Enable streaming
            temperature: Some(0.7),
        };
        
        let mut req = self.client.post(url).json(&body);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
        
        let resp = req.send().await?;
        if !resp.status().is_success() {
             let err_text = resp.text().await.unwrap_or_default();
             return Err(OpenAIError::ApiError(format!("Stream error: {}", err_text)));
        }

        // Process SSE stream
        use futures_util::StreamExt;
        
        let mut stream = resp.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res?;
            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);
            
            // SSE lines end with \n\n usually.
            // A single chunk might contain multiple data: lines or partial lines
            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim().to_string();
                buffer = buffer[pos+1..].to_string();
                
                if line.starts_with("data: ") {
                    let data = &line["data: ".len()..];
                    if data == "[DONE]" {
                        break;
                    }
                    
                    // Parse the JSON chunk
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                            if let Some(first_choice) = choices.first() {
                                if let Some(delta) = first_choice.get("delta") {
                                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                        on_chunk(content.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
}
