import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { grammarService, GrammarSuggestion } from "./grammarService";
import { FaExclamationCircle } from "@react-icons/all-files/fa/FaExclamationCircle";
import { FaCheckCircle } from "@react-icons/all-files/fa/FaCheckCircle";
import { FaLightbulb } from "@react-icons/all-files/fa/FaLightbulb";

interface GrammarCheckerProps {
  text: string;
  onApplySuggestion?: (
    replacement: string,
    offset: number,
    length: number,
  ) => void;
  enabled?: boolean;
}

export const GrammarChecker = ({
  text,
  onApplySuggestion,
  enabled = true,
}: GrammarCheckerProps) => {
  const [suggestions, setSuggestions] = useState<GrammarSuggestion[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (!enabled || !text || text.length < 10) {
      setSuggestions([]);
      return;
    }

    const checkText = async () => {
      setIsChecking(true);
      try {
        const results = await grammarService.checkGrammar(text);
        setSuggestions(results);
      } catch (error) {
        console.error("Grammar check error:", error);
      } finally {
        setIsChecking(false);
      }
    };

    // Debounce grammar checking
    const timer = setTimeout(checkText, 1500);
    return () => clearTimeout(timer);
  }, [text, enabled]);

  const handleApplySuggestion = (
    suggestion: GrammarSuggestion,
    replacement: string,
  ) => {
    if (onApplySuggestion) {
      onApplySuggestion(replacement, suggestion.offset, suggestion.length);
      // Remove the applied suggestion
      setSuggestions((prev) =>
        prev.filter((s) => s.offset !== suggestion.offset),
      );
    }
  };

  const getTypeIcon = (type: GrammarSuggestion["type"]) => {
    switch (type) {
      case "spelling":
        return <FaExclamationCircle className="w-4 h-4 text-red-500" />;
      case "grammar":
        return <FaCheckCircle className="w-4 h-4 text-blue-500" />;
      case "style":
        return <FaLightbulb className="w-4 h-4 text-amber-500" />;
    }
  };

  const getTypeLabel = (type: GrammarSuggestion["type"]) => {
    switch (type) {
      case "spelling":
        return "Spelling";
      case "grammar":
        return "Grammar";
      case "style":
        return "Style";
    }
  };

  const getTypeColor = (type: GrammarSuggestion["type"]) => {
    switch (type) {
      case "spelling":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      case "grammar":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case "style":
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    }
  };

  const dismissSuggestion = (offset: number) => {
    setSuggestions((prev) => prev.filter((s) => s.offset !== offset));
  };

  // Group suggestions by type
  const groupedSuggestions = {
    spelling: suggestions.filter((s) => s.type === "spelling"),
    grammar: suggestions.filter((s) => s.type === "grammar"),
    style: suggestions.filter((s) => s.type === "style"),
  };

  const totalIssues = suggestions.length;

  if (!enabled || totalIssues === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Floating indicator badge - Word-like */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-40 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-4 py-2.5 shadow-xl border border-gray-200 dark:border-gray-700 flex items-center gap-3"
        onClick={() => setShowPanel(!showPanel)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2">
          {groupedSuggestions.spelling.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                {groupedSuggestions.spelling.length}
              </span>
            </div>
          )}
          {groupedSuggestions.grammar.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {groupedSuggestions.grammar.length}
              </span>
            </div>
          )}
          {groupedSuggestions.style.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {groupedSuggestions.style.length}
              </span>
            </div>
          )}
        </div>
        <span className="text-sm font-medium">
          {totalIssues} {totalIssues === 1 ? "suggestion" : "suggestions"}
        </span>
      </motion.button>

      {/* Suggestions panel - Word-like interface */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed right-6 bottom-24 z-50 w-[420px] max-h-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <FaCheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Writing Assistant
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {totalIssues} {totalIssues === 1 ? "issue" : "issues"} found
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Statistics Bar */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-3">
              {groupedSuggestions.spelling.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Spelling
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {groupedSuggestions.spelling.length}
                    </div>
                  </div>
                </div>
              )}
              {groupedSuggestions.grammar.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Grammar
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {groupedSuggestions.grammar.length}
                    </div>
                  </div>
                </div>
              )}
              {groupedSuggestions.style.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Style
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {groupedSuggestions.style.length}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions list */}
            <div className="flex-1 overflow-y-auto">
              {isChecking && (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-sm">Analyzing your writing...</p>
                </div>
              )}

              {!isChecking && (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.entries(groupedSuggestions).map(([type, items]) => {
                    if (items.length === 0) return null;
                    return (
                      <div key={type} className="p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                          {getTypeIcon(type as GrammarSuggestion["type"])}
                          {getTypeLabel(type as GrammarSuggestion["type"])}{" "}
                          Issues
                        </h4>
                        <div className="space-y-3">
                          {items.map((suggestion, index) => (
                            <motion.div
                              key={`${suggestion.offset}-${index}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className={`p-3 rounded-lg border ${getTypeColor(suggestion.type)}`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                                  {suggestion.message}
                                </p>
                                <button
                                  onClick={() =>
                                    dismissSuggestion(suggestion.offset)
                                  }
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs flex-shrink-0 hover:bg-white/50 dark:hover:bg-black/20 rounded p-1 transition-colors"
                                  title="Dismiss"
                                >
                                  ✕
                                </button>
                              </div>

                              {suggestion.context && (
                                <div className="mb-2 p-2 bg-white/60 dark:bg-black/20 rounded text-xs font-mono text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-gray-600/50">
                                  <span className="opacity-50">...</span>
                                  {suggestion.context}
                                  <span className="opacity-50">...</span>
                                </div>
                              )}

                              {suggestion.replacements.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {suggestion.replacements.map(
                                    (replacement, repIndex) => (
                                      <motion.button
                                        key={repIndex}
                                        onClick={() =>
                                          handleApplySuggestion(
                                            suggestion,
                                            replacement,
                                          )
                                        }
                                        className="px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 transition-all shadow-sm"
                                        whileHover={{ scale: 1.02, y: -1 }}
                                        whileTap={{ scale: 0.98 }}
                                      >
                                        <span className="mr-1">→</span>
                                        {replacement}
                                      </motion.button>
                                    ),
                                  )}
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {!isChecking && totalIssues > 0 && (
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => setSuggestions([])}
                  className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
                >
                  Dismiss all
                </button>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Writing Assistant
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GrammarChecker;
