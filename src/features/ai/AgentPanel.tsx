import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { AIAction, AgentPanelState, BackendType } from './types';
import { aiService } from './aiService';
import { extractTextFromPDF } from './pdfExtractor';
import { FaFilePdf } from '@react-icons/all-files/fa/FaFilePdf';

interface AgentPanelProps {
  state: AgentPanelState;
  actions: AIAction[];
  isOllamaRunning: boolean;
  onClose: () => void;
  onExecuteAction: (actionId: string, selectionOverride?: string, pageContext?: string) => Promise<void>;
  onInsertResponse?: (response: string) => void;
  setSelectedText: (text: string) => void;
}

export const AgentPanel = ({
  state,
  actions,
  isOllamaRunning,
  onClose,
  onExecuteAction,
  onInsertResponse,
  setSelectedText,
}: AgentPanelProps) => {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingPDF, setIsLoadingPDF] = useState(false);
  const [backend, setBackend] = useState<BackendType>('Ollama');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [model, setModel] = useState('llama3.2:3b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');

  // Handle PDF file upload
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingPDF(true);
    try {
      const text = await extractTextFromPDF(file);
      // Update selected text for visibility
      setSelectedText(text.slice(0, 5000));
      const summarizeAction = actions.find(a => a.id === 'summarize');
      if (summarizeAction) {
        await onExecuteAction('summarize', text.slice(0, 5000), text.slice(0, 5000));
      }
    } catch (error) {
      alert(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingPDF(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load config and models
  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await aiService.getState();
        setBackend(cfg.backend);
        setBaseUrl(cfg.base_url);
        setModel(cfg.model);
        const models = await aiService.listModels();
        setAvailableModels(models);
      } catch (e) {
        // ignore for now
      }
    };
    load();
  }, []);

  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center pointer-events-auto">
      <div
        ref={panelRef}
        className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-[70vh] max-h-[600px] flex flex-col rounded-t-xl border-t border-zinc-200 dark:border-zinc-800 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-800 rounded-t-xl">
          <div>
            <h2 className="font-bold text-lg text-white">✨ AI Assistant</h2>
            <p className="text-sm text-blue-100 mt-1">
              {isOllamaRunning ? (
                <>
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2" />
                  Backend connected
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2" />
                  Connecting...
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 transition-colors p-2 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Status / Selected Text */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Selected text:</p>
            <p className="text-sm text-zinc-900 dark:text-zinc-50 line-clamp-2 italic">
              {state.selectedText || 'No text selected'}
            </p>
          </div>

          {/* Settings */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block mb-1.5 text-zinc-600 dark:text-zinc-400 font-medium">Backend</label>
              <select
                value={backend}
                onChange={e => setBackend(e.target.value as BackendType)}
                className="w-full px-2 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700"
              >
                <option value="Ollama">Ollama</option>
                <option value="OpenAI">LM Studio/GPT4All</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-zinc-600 dark:text-zinc-400 font-medium">Base URL</label>
              <input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700"
                placeholder={backend === 'Ollama' ? 'localhost:11434' : 'localhost:1234'}
              />
            </div>
            <div className="flex flex-col">
              <label className="block mb-1.5 text-zinc-600 dark:text-zinc-400 font-medium">Model</label>
              <div className="flex gap-1">
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700"
                >
                  {[model, ...availableModels.filter(m => m !== model)].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    try {
                      await aiService.setState(backend, baseUrl, model);
                      const models = await aiService.listModels();
                      setAvailableModels(models);
                    } catch (e) {
                      console.error('Failed to save config:', e);
                    }
                  }}
                  className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs flex flex-col gap-2">
            <label className="text-zinc-700 dark:text-zinc-200 font-semibold text-sm">Custom Prompt</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-sm"
              placeholder="Ask anything or give instructions..."
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCustomPrompt('')}
                className="px-3 py-2 text-sm rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              >
                Clear
              </button>
              <button
                disabled={!customPrompt.trim()}
                onClick={() => onExecuteAction('custom_prompt', state.selectedText || '', customPrompt)}
                className="px-4 py-2 text-sm rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run Prompt
              </button>
            </div>
          </div>

          {/* PDF Upload Section */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePDFUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingPDF}
              className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <FaFilePdf size={16} />
              {isLoadingPDF ? 'Processing PDF...' : 'Upload & Summarize PDF'}
            </button>
          </div>

          {/* Actions Grid */}
          {!state.response && !state.isLoading && (
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Quick Actions:</p>
              <div className="grid grid-cols-3 gap-2">
                {actions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => onExecuteAction(action.id)}
                    disabled={!isOllamaRunning}
                    onMouseEnter={() => setHoveredAction(action.id)}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                      'p-3 rounded-lg text-left transition-all group relative border',
                      isOllamaRunning
                        ? 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md hover:scale-105'
                        : 'bg-zinc-100 dark:bg-zinc-800 opacity-40 cursor-not-allowed border-zinc-300 dark:border-zinc-700'
                    )}
                  >
                    <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                      {action.name}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-1">
                      {action.description}
                    </div>

                    {/* Tooltip */}
                    {hoveredAction === action.id && isOllamaRunning && (
                      <div className="absolute -top-8 left-0 bg-zinc-900 dark:bg-zinc-950 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        {action.system_prompt}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {state.isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Generating response...</p>
              </div>
            </div>
          )}

          {/* Response Display */}
          {state.response && !state.isLoading && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/10">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                  {actions.find(a => a.id === state.selectedAction)?.name || 'Response'}:
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-sm text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">
                  {state.response}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {state.error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {state.response && !state.isLoading && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-800/30">
            <button
              onClick={() => {
                onInsertResponse?.(state.response);
                onClose();
              }}
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Insert Response
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(state.response);
              }}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
