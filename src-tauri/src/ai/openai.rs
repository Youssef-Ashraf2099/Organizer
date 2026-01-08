use serde::{Deserialize, Serialize};
use thiserror::Error;

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
            temperature,
            max_tokens,
        };
        let mut req = self.client.post(url).json(&body);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(OpenAIError::ApiError(format!("status {}", resp.status())));
        }
        let parsed: ChatResp = resp.json().await?;
        let text = parsed.choices.get(0).map(|c| c.message.content.clone()).unwrap_or_default();
        Ok(text)
    }
}
