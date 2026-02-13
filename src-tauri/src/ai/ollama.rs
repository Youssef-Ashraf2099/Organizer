use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum OllamaError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("Ollama API error: {0}")]
    ApiError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String, // "system", "user", or "assistant"
    pub content: String,
}

pub type OllamaResult<T> = Result<T, OllamaError>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaRequest {
    pub model: String,
    pub prompt: String,
    pub stream: bool,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub num_predict: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaResponse {
    pub model: String,
    pub created_at: String,
    pub response: String,
    pub done: bool,
    #[serde(default)]
    pub context: Option<Vec<i32>>,
    #[serde(default)]
    pub total_duration: Option<i64>,
    #[serde(default)]
    pub load_duration: Option<i64>,
    #[serde(default)]
    pub prompt_eval_count: Option<i32>,
    #[serde(default)]
    pub prompt_eval_duration: Option<i64>,
    #[serde(default)]
    pub eval_count: Option<i32>,
    #[serde(default)]
    pub eval_duration: Option<i64>,
}

/// Ollama client for local LLM inference
pub struct OllamaClient {
    base_url: String,
    client: reqwest::Client,
    default_model: String,
}

impl OllamaClient {
    /// Create new Ollama client pointing to localhost:11434 (default Ollama port)
    pub fn new(base_url: Option<String>, default_model: String) -> Self {
        Self {
            base_url: base_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
            client: reqwest::Client::new(),
            default_model,
        }
    }

    /// Generate text from a prompt
    pub async fn generate(
        &self,
        prompt: &str,
        temperature: Option<f32>,
        max_tokens: Option<i32>,
    ) -> OllamaResult<String> {
        let request = OllamaRequest {
            model: self.default_model.clone(),
            prompt: prompt.to_string(),
            stream: false,
            temperature: temperature.or(Some(0.7)),
            num_predict: max_tokens,
        };

        let response = self
            .client
            .post(format!("{}/api/generate", self.base_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(OllamaError::ApiError(format!(
                "Ollama API returned: {}",
                response.status()
            )));
        }

        let ollama_response: OllamaResponse = response.json().await?;
        Ok(ollama_response.response)
    }

    /// Stream text generation (for real-time responses)
    /// Returns a stream of chunks
    pub async fn generate_stream(
        &self,
        prompt: &str,
        temperature: Option<f32>,
        max_tokens: Option<i32>,
    ) -> OllamaResult<reqwest::Client> {
        let request = OllamaRequest {
            model: self.default_model.clone(),
            prompt: prompt.to_string(),
            stream: true,
            temperature: temperature.or(Some(0.7)),
            num_predict: max_tokens,
        };

        let response = self
            .client
            .post(format!("{}/api/generate", self.base_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(OllamaError::ApiError(format!(
                "Ollama API returned: {}",
                response.status()
            )));
        }

        Ok(self.client.clone())
    }

    /// Check if Ollama is running and accessible
    pub async fn health_check(&self) -> OllamaResult<bool> {
        match self.client.get(format!("{}/api/tags", self.base_url)).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }

    /// List available models
    pub async fn list_models(&self) -> OllamaResult<Vec<String>> {
        #[derive(Deserialize)]
        struct TagsResponse {
            models: Vec<Model>,
        }

        #[derive(Deserialize)]
        struct Model {
            name: String,
        }

        let response = self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(OllamaError::ApiError(format!(
                "Failed to list models: {}",
                response.status()
            )));
        }

        let tags: TagsResponse = response.json().await?;
        Ok(tags.models.iter().map(|m| m.name.clone()).collect())
    }

    /// Chat with the model (conversational interface)
    pub async fn chat(
        &self,
        messages: Vec<ChatMessage>,
    ) -> OllamaResult<String> {
        #[derive(Serialize)]
        struct ChatRequest {
            model: String,
            messages: Vec<ChatMessage>,
            stream: bool,
        }

        #[derive(Deserialize)]
        struct ChatResponse {
            message: ChatMessage,
        }

        let request = ChatRequest {
            model: self.default_model.clone(),
            messages,
            stream: false,
        };

        let response = self
            .client
            .post(format!("{}/api/chat", self.base_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(OllamaError::ApiError(format!(
                "Ollama chat API returned: {}",
                response.status()
            )));
        }

        let chat_response: ChatResponse = response.json().await?;
        Ok(chat_response.message.content)
    }
}
