pub mod ollama;
pub mod rag;
pub mod operations;
pub mod openai;

pub use ollama::OllamaClient;
pub use ollama::ChatMessage;
pub use rag::RAGEngine;
pub use operations::{EditOperation, EditOperationType};
pub use openai::OpenAIClient;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BackendType {
	Ollama,
	OpenAI, // OpenAI-compatible local server (e.g., LM Studio, GPT4All server)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
	pub backend: BackendType,
	pub base_url: String, // e.g., http://localhost:11434 for Ollama, http://localhost:1234 for LM Studio
	pub model: String,
}

impl Default for AiConfig {
	fn default() -> Self {
		Self {
			backend: BackendType::OpenAI,
			base_url: "http://127.0.0.1:1234".to_string(),
			model: "llama-3.2-3b-instruct".to_string(),
		}
	}
}

