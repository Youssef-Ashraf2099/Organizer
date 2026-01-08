import { invoke } from "@tauri-apps/api/core";
import { AIAction, AiConfig, BackendType } from "./types";

export const aiService = {
  /// Check if Ollama is running
  async healthCheck(): Promise<boolean> {
    try {
      return await invoke<boolean>("ai_health_check");
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  },

  /// Get list of available models
  async listModels(): Promise<string[]> {
    try {
      return await invoke<string[]>("ai_list_models");
    } catch (error) {
      console.error("Failed to list models:", error);
      return [];
    }
  },

  /// Get predefined AI actions
  async getActions(): Promise<AIAction[]> {
    try {
      return await invoke<AIAction[]>("ai_get_actions");
    } catch (error) {
      console.error("Failed to get actions:", error);
      return [];
    }
  },

  /// Execute an AI action
  async executeAction(
    pageId: string,
    actionId: string,
    selection: string,
    pageContext?: string
  ): Promise<string> {
    try {
      return await invoke<string>("ai_execute_action", {
        // Some Tauri versions expect camelCase, others the exact arg name; send both to be safe
        _page_id: pageId,
        page_id: pageId,
        pageId,
        action_id: actionId,
        actionId,
        selection,
        page_context: pageContext,
        pageContext,
      });
    } catch (error) {
      console.error("Failed to execute action:", error);
      throw error;
    }
  },

  /// Get current AI state
  async getState(): Promise<AiConfig> {
    try {
      return await invoke<AiConfig>("ai_get_state");
    } catch (error) {
      console.error("Failed to get AI state:", error);
      throw error;
    }
  },

  /// Update AI state (backend, base_url, model)
  async setState(
    backend: BackendType,
    baseUrl: string,
    model: string
  ): Promise<void> {
    await invoke("ai_set_state", {
      backend,
      // Provide both snake_case and camelCase to satisfy different Tauri arg parsers
      base_url: baseUrl,
      baseUrl,
      model,
    });
  },
};
