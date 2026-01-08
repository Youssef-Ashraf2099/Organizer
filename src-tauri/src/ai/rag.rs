use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RAGError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("No results found")]
    NoResults,
}

pub type RAGResult<T> = Result<T, RAGError>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub page_id: String,
    pub page_title: String,
    pub content: String,
    pub relevance: f32,
}

/// RAG (Retrieval-Augmented Generation) engine for semantic search
/// Note: For MVP, we use simple FTS5 search. Future versions will use embeddings.
pub struct RAGEngine;

impl RAGEngine {
    pub fn new() -> Self {
        Self
    }

    /// Build a prompt for the LLM with context from a page
    /// In MVP, we focus on context assembly rather than complex RAG
    pub fn build_context_prompt(
        &self,
        query: &str,
        page_context: &str,
        instruction: &str,
    ) -> RAGResult<String> {
        let prompt = format!(
            r#"You are an intelligent document assistant for a productivity workspace.

CURRENT CONTEXT:
{page_context}

USER REQUEST: {query}

INSTRUCTION: {instruction}

Provide a focused, actionable response based on the context above.
Keep your response concise and direct."#,
            page_context = page_context,
            query = query,
            instruction = instruction
        );

        Ok(prompt)
    }
}
