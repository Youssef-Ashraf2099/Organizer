export interface AIAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  system_prompt: string;
}

export interface EditOperation {
  op_type: "insert" | "replace" | "delete" | "updatePage";
  page_id: string;
  block_id?: string;
  position?: number;
  content?: unknown;
  reason: string;
}

export interface AgentPanelState {
  isOpen: boolean;
  isLoading: boolean;
  selectedAction?: string;
  selectedText: string;
  response: string;
  error?: string;
  isExecutingTool?: boolean; // New state for "Building..." animation
}

export type BackendType = "Ollama" | "OpenAI";

export interface AiConfig {
  backend: BackendType;
  base_url: string;
  model: string;
}

export interface ToolCommand {
  action: string;
  params?: Record<string, any>;
}
