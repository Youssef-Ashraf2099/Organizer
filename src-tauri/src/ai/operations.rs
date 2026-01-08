use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Types of operations the AI agent can perform on pages
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum EditOperationType {
    /// Insert a new block at a specific position
    Insert,
    /// Replace an existing block with new content
    Replace,
    /// Delete a block
    Delete,
    /// Update page metadata (title, icon, etc)
    UpdatePage,
}

/// A structured edit operation that can be applied to a page
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EditOperation {
    pub op_type: EditOperationType,
    pub page_id: String,
    pub block_id: Option<String>,
    pub position: Option<usize>, // For insert operations
    pub content: Option<Value>, // Block content (JSON)
    pub reason: String, // Why the AI made this change
}

impl EditOperation {
    /// Create an insert operation
    pub fn insert(
        page_id: String,
        content: Value,
        position: usize,
        reason: String,
    ) -> Self {
        Self {
            op_type: EditOperationType::Insert,
            page_id,
            block_id: None,
            position: Some(position),
            content: Some(content),
            reason,
        }
    }

    /// Create a replace operation
    pub fn replace(
        page_id: String,
        block_id: String,
        content: Value,
        reason: String,
    ) -> Self {
        Self {
            op_type: EditOperationType::Replace,
            page_id,
            block_id: Some(block_id),
            position: None,
            content: Some(content),
            reason,
        }
    }

    /// Create a delete operation
    pub fn delete(page_id: String, block_id: String, reason: String) -> Self {
        Self {
            op_type: EditOperationType::Delete,
            page_id,
            block_id: Some(block_id),
            position: None,
            content: None,
            reason,
        }
    }

    /// Create an update page metadata operation
    pub fn update_page(page_id: String, content: Value, reason: String) -> Self {
        Self {
            op_type: EditOperationType::UpdatePage,
            page_id,
            block_id: None,
            position: None,
            content: Some(content),
            reason,
        }
    }
}

/// Predefined AI actions (slash commands that appear in editor)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIAction {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub system_prompt: String,
}

impl AIAction {
    /// Library of predefined actions
    pub fn default_actions() -> Vec<Self> {
        vec![
            AIAction {
                id: "summarize".to_string(),
                name: "Summarize".to_string(),
                description: "Create a concise summary of the selected text".to_string(),
                icon: "summarize".to_string(),
                system_prompt: "Create a clear, concise summary of the following content. Keep it 2-3 sentences.".to_string(),
            },
            AIAction {
                id: "rewrite".to_string(),
                name: "Rewrite".to_string(),
                description: "Rewrite selected text in a different style or tone".to_string(),
                icon: "edit".to_string(),
                system_prompt: "Rewrite the following content to be more professional and concise:".to_string(),
            },
            AIAction {
                id: "expand".to_string(),
                name: "Expand".to_string(),
                description: "Add more detail and depth to the selected text".to_string(),
                icon: "expand".to_string(),
                system_prompt: "Expand on the following content with more detail, examples, and explanation:".to_string(),
            },
            AIAction {
                id: "explain".to_string(),
                name: "Explain".to_string(),
                description: "Provide a detailed explanation of the selected content".to_string(),
                icon: "help".to_string(),
                system_prompt: "Explain the following concept in detail, as if teaching someone unfamiliar with it:".to_string(),
            },
            AIAction {
                id: "generate_outline".to_string(),
                name: "Generate Outline".to_string(),
                description: "Create a structured outline from the selected text".to_string(),
                icon: "list".to_string(),
                system_prompt: "Create a hierarchical outline of the following content. Use proper markdown formatting with # for headers.".to_string(),
            },
            AIAction {
                id: "generate_tasks".to_string(),
                name: "Generate Tasks".to_string(),
                description: "Extract action items and create a task list".to_string(),
                icon: "task".to_string(),
                system_prompt: "Extract all action items and tasks from the following content. Format as a bullet list with [] checkboxes.".to_string(),
            },
            AIAction {
                id: "generate_mermaid".to_string(),
                name: "Generate Diagram".to_string(),
                description: "Auto-generate a Mermaid diagram from the content".to_string(),
                icon: "diagram".to_string(),
                system_prompt: "Generate a Mermaid diagram (flowchart, ER, or mindmap format) that visualizes the following content. Return ONLY the Mermaid code, no explanation.".to_string(),
            },
            AIAction {
                id: "generate_table".to_string(),
                name: "Generate Table".to_string(),
                description: "Create a structured table from the content".to_string(),
                icon: "table".to_string(),
                system_prompt: "Convert the following content into a well-structured markdown table. Return ONLY the table, no explanation.".to_string(),
            },
            AIAction {
                id: "check_grammar".to_string(),
                name: "Check Grammar".to_string(),
                description: "Review and correct grammar and spelling".to_string(),
                icon: "check".to_string(),
                system_prompt: "Review the following text for grammar, spelling, and clarity issues. Return the corrected version without explaining changes.".to_string(),
            },
            AIAction {
                id: "custom_prompt".to_string(),
                name: "Custom Prompt".to_string(),
                description: "Run your own instructions on the selected or uploaded text".to_string(),
                icon: "prompt".to_string(),
                system_prompt: "Follow the user's custom instruction to produce the best possible answer.".to_string(),
            },
        ]
    }
}
