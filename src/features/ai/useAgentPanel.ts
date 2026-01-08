import { useState, useCallback, useEffect } from 'react';
import { aiService } from './aiService';
import { AIAction, AgentPanelState } from './types';

const initialState: AgentPanelState = {
  isOpen: false,
  isLoading: false,
  selectedText: '',
  response: '',
};

export const useAgentPanel = () => {
  const [state, setState] = useState<AgentPanelState>(initialState);
  const [actions, setActions] = useState<AIAction[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(false);

  // Load available actions on mount
  useEffect(() => {
    const loadActions = async () => {
      const acts = await aiService.getActions();
      setActions(acts);
    };
    loadActions();
  }, []);

  // Check Ollama health periodically
  useEffect(() => {
    const checkHealth = async () => {
      const running = await aiService.healthCheck();
      setIsOllamaRunning(running);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  const openPanel = useCallback((selectedText: string) => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      selectedText,
      response: '',
      error: undefined,
    }));
  }, []);

  const closePanel = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      selectedAction: undefined,
    }));
  }, []);

  const executeAction = useCallback(
    async (pageId: string, actionId: string, selectionOverride?: string, pageContext?: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));

      try {
        const response = await aiService.executeAction(
          pageId,
          actionId,
          selectionOverride ?? state.selectedText,
          pageContext
        );

        setState(prev => ({
          ...prev,
          isLoading: false,
          response,
          selectedAction: actionId,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to execute action',
        }));
      }
    },
    [state.selectedText]
  );

  const setSelectedText = useCallback((text: string) => {
    setState(prev => ({ ...prev, selectedText: text }));
  }, []);

  return {
    state,
    actions,
    isOllamaRunning,
    openPanel,
    closePanel,
    executeAction,
    setSelectedText,
  };
};
