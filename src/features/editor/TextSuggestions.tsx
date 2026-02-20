import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { grammarService, AutocompleteSuggestion } from "./grammarService";
import { FaLightbulb } from "@react-icons/all-files/fa/FaLightbulb";
import { FaSpellCheck } from "@react-icons/all-files/fa/FaSpellCheck";
import { FaKeyboard } from "@react-icons/all-files/fa/FaKeyboard";

interface TextSuggestionsProps {
  text: string;
  cursorPosition: number;
  onAcceptSuggestion: (suggestion: string) => void;
  enabled?: boolean;
}

export const TextSuggestions = ({
  text,
  cursorPosition,
  onAcceptSuggestion,
  enabled = true,
}: TextSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!enabled || !text) {
      setShowSuggestions(false);
      return;
    }

    const getSuggestions = async () => {
      // Get autocomplete suggestions
      const autocompleteSuggestions = grammarService.getAutocompleteSuggestions(
        text,
        cursorPosition,
      );

      if (autocompleteSuggestions.length > 0) {
        setSuggestions(autocompleteSuggestions);
        setSelectedIndex(0);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    };

    // Debounce the suggestions
    const timer = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timer);
  }, [text, cursorPosition, enabled]);

  const handleAccept = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      onAcceptSuggestion(suggestion.text);
      setShowSuggestions(false);
    },
    [onAcceptSuggestion],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev === 0 ? suggestions.length - 1 : prev - 1,
          );
          break;
        case "Enter":
        case "Tab":
          if (showSuggestions) {
            event.preventDefault();
            handleAccept(suggestions[selectedIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          setShowSuggestions(false);
          break;
      }
    },
    [showSuggestions, suggestions, selectedIndex, handleAccept],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "phrase":
        return <FaLightbulb className="w-3 h-3" />;
      case "word":
        return <FaKeyboard className="w-3 h-3" />;
      case "template":
        return <FaSpellCheck className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {showSuggestions && suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{
            maxWidth: "300px",
            minWidth: "200px",
          }}
        >
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={`${suggestion.text}-${index}`}
                onClick={() => handleAccept(suggestion)}
                className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                  index === selectedIndex
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-gray-500 dark:text-gray-400">
                  {getCategoryIcon(suggestion.category)}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{suggestion.text}</div>
                  {suggestion.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {suggestion.description}
                    </div>
                  )}
                </div>
                {index === selectedIndex && (
                  <span className="text-xs text-gray-400">↵</span>
                )}
              </motion.button>
            ))}
          </div>
          <div className="px-3 py-1 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span>Use ↑↓ to navigate</span>
              <span>•</span>
              <span>↵ Tab to accept</span>
              <span>•</span>
              <span>Esc to dismiss</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TextSuggestions;
