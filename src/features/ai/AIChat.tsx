import { useState, useEffect, useRef } from "react";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaPaperPlane } from "@react-icons/all-files/fa/FaPaperPlane";
import { FaCopy } from "@react-icons/all-files/fa/FaCopy";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaCog } from "@react-icons/all-files/fa/FaCog";
import { FaFileUpload } from "@react-icons/all-files/fa/FaFileUpload";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// @ts-ignore
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";
import { aiService } from "./aiService";
import { invoke } from "@tauri-apps/api/core";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

export const AIChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isOllamaRunning, setIsOllamaRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:1234");
  const [isInitialized, setIsInitialized] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typingContent, setTypingContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Configure pdf.js worker
  useEffect(() => {
    // Avoid reassigning if already set
    if (!(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
        /* @vite-ignore */ new URL(
          "pdfjs-dist/build/pdf.worker.min.js",
          import.meta.url
        ).toString();
    }
  }, []);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("ai-conversations");
    if (saved) {
      const loadedConvs = JSON.parse(saved);
      console.log(
        "💬 Loaded",
        loadedConvs.length,
        "conversations from localStorage"
      );
      setConversations(loadedConvs);
    } else {
      console.log("💬 No saved conversations found");
    }
    setIsInitialized(true);
  }, []);

  // Save conversations to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("ai-conversations", JSON.stringify(conversations));
      console.log(
        "💾 Saved",
        conversations.length,
        "conversations to localStorage"
      );
    }
  }, [conversations, isInitialized]);

  // Load models and check health
  useEffect(() => {
    const loadModels = async () => {
      const running = await aiService.healthCheck();
      setIsOllamaRunning(running);

      if (running) {
        const modelList = await aiService.listModels();
        setModels(modelList);
        if (modelList.length > 0 && !selectedModel) {
          setSelectedModel(modelList[0]);
        }
      }
    };

    loadModels();
    const interval = setInterval(loadModels, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [selectedModel]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConvId, conversations]);

  useEffect(() => {
    setTypingMessageId(null);
    setTypingContent("");
  }, [currentConvId]);

  // Animate assistant responses with a simple typing effect
  useEffect(() => {
    if (!typingMessageId) return;

    const conv = conversations.find((c) => c.id === currentConvId);
    const message = conv?.messages.find((m) => m.id === typingMessageId);
    if (!message) return;

    const fullText = message.content;
    let index = 0;
    const step = Math.max(1, Math.ceil(fullText.length / 400));

    const interval = setInterval(() => {
      index += step;
      setTypingContent(fullText.slice(0, index));

      if (index >= fullText.length) {
        clearInterval(interval);
        setTypingMessageId(null);
        setTypingContent("");
      }
    }, 12);

    return () => clearInterval(interval);
  }, [typingMessageId, conversations, currentConvId]);

  // Keep view pinned to the bottom while the typing effect runs
  useEffect(() => {
    if (typingMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [typingContent, typingMessageId]);

  const currentConv = conversations.find((c) => c.id === currentConvId);

  const createNewChat = () => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
    };
    setConversations([newConv, ...conversations]);
    setCurrentConvId(newConv.id);
  };

  const deleteConversation = (id: string) => {
    if (confirm("Delete this conversation?")) {
      setConversations(conversations.filter((c) => c.id !== id));
      if (currentConvId === id) {
        setCurrentConvId(conversations[0]?.id || null);
      }
    }
  };

  const sendMessage = async () => {
    if (
      !inputValue.trim() ||
      !currentConvId ||
      isLoading ||
      !isOllamaRunning ||
      !selectedModel
    )
      return;

    const filesContext = await buildFilesContext();
    const formatHint =
      "\n\nPlease format the answer in GitHub-flavored Markdown with clear headings, bullet points, numbered lists when appropriate, and fenced code blocks for any code. Keep responses concise and structured.";

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue,
      timestamp: Date.now(),
    };

    const messageText = inputValue;
    setConversations(
      conversations.map((c) =>
        c.id === currentConvId
          ? {
              ...c,
              messages: [...c.messages, userMessage],
              title:
                c.messages.length === 0 ? messageText.slice(0, 30) : c.title,
            }
          : c
      )
    );

    setInputValue("");
    setIsLoading(true);

    try {
      // Get conversation history for context
      const conv = conversations.find((c) => c.id === currentConvId);
      const messages = conv?.messages || [];

      // Call Ollama API
      const response = await invoke<string>("ai_chat", {
        message: `${messageText}${filesContext}${formatHint}`,
        model: selectedModel,
        base_url: baseUrl,
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }).catch(async () => {
        // Fallback to direct HTTP call if Tauri command not available
        const res = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            prompt: `${messageText}${filesContext}${formatHint}`,
            stream: false,
          }),
        });
        const data = await res.json();
        return data.response;
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response || "No response received",
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId
            ? { ...c, messages: [...c.messages, assistantMessage] }
            : c
        )
      );
      setTypingMessageId(assistantMessage.id);
      setTypingContent("");
      setUploadedFiles([]);
    } catch (error) {
      console.error("Failed to get AI response:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Error: Failed to get response from AI. Please check if Ollama is running.",
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId
            ? { ...c, messages: [...c.messages, errorMessage] }
            : c
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Component to render markdown with syntax highlighting
  const MarkdownRenderer = ({ content }: { content: string }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code(props) {
          const { children, className, ...rest } = props;
          const match = /language-(\w+)/.exec(className || "");
          const lang = match ? match[1] : "text";
          return (
            <SyntaxHighlighter
              {...rest}
              language={lang}
              style={oneDark}
              className="rounded-lg my-2"
              wrapLongLines
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          );
        },
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold my-3 text-zinc-100">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold my-2 text-zinc-200">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-bold my-2 text-zinc-300">{children}</h3>
        ),
        p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc list-inside my-2 space-y-1 text-zinc-200">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside my-2 space-y-1 text-zinc-200">
            {children}
          </ol>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-500 pl-4 my-2 text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <table className="border-collapse border border-zinc-600 my-2">
            {children}
          </table>
        ),
        th: ({ children }) => (
          <th className="border border-zinc-600 px-3 py-2 bg-zinc-800">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-zinc-600 px-3 py-2">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const copyToClipboard = (text: string, messageId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).filter((file) => {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        return isImage || isPdf;
      });
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer })
      .promise;
    const pageTexts: string[] = [];
    const pageCount = Math.min(pdf.numPages, 8); // limit pages for performance
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item: any) => (item.str ? item.str.toString() : ""))
        .filter(Boolean);
      pageTexts.push(strings.join(" "));
    }
    return pageTexts.join("\n\n");
  };

  const buildFilesContext = async () => {
    if (!uploadedFiles.length) return "";

    const pdfs = uploadedFiles.filter((f) => f.type === "application/pdf");
    const contexts: string[] = [];

    for (const pdf of pdfs) {
      try {
        const text = await extractPdfText(pdf);
        if (text.trim()) {
          contexts.push(`File: ${pdf.name}\n${text.substring(0, 12000)}`);
        }
      } catch (err) {
        console.warn("Failed to read PDF", pdf.name, err);
      }
    }

    if (!contexts.length) return "";
    return `\n\nAttached PDF context (summarized):\n\n${contexts.join(
      "\n\n---\n\n"
    )}\n\nUse this context in your answer.`;
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // const saveMessageToPage = async (content: string) => {
  //   const newPageId = await addPage(null, null);
  //   if (newPageId) {
  //     setActivePage(newPageId);
  //   }
  // };

  // const saveConversationToPage = async () => {
  //   if (!currentConv) return;

  //   const conversationText = currentConv.messages
  //     .map(m => `${m.role === 'user' ? '👤 You' : '🤖 AI'}:\n${m.content}`)
  //     .join('\n\n---\n\n');

  //   const newPageId = await addPage(null, null);
  //   if (newPageId) {
  //     setActivePage(newPageId);
  //   }
  // };

  return (
    <div className="h-full flex gap-0 bg-gradient-to-b from-[#0d1117] via-[#0b1020] to-[#080c15] text-slate-100">
      {/* Sidebar - Conversations List */}
      <div className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-900">
        {/* Header with Settings */}
        <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
          <button
            onClick={createNewChat}
            className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition text-sm"
          >
            <FaPlus size={14} />
            New Chat
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition"
            title="Settings"
          >
            <FaCog size={14} className={showSettings ? "text-blue-500" : ""} />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-3 border-b border-zinc-800 space-y-2 bg-zinc-800/50">
            {/* Model Selection */}
            <div>
              <label className="text-xs font-medium text-zinc-400">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!isOllamaRunning}
                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-50"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Base URL */}
            <div>
              <label className="text-xs font-medium text-zinc-400">URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
              />
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  isOllamaRunning ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="text-zinc-400">
                {isOllamaRunning ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto space-y-1 px-2 py-2">
          {conversations.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs py-8">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group p-2.5 rounded-lg cursor-pointer transition flex items-start justify-between gap-2 ${
                  currentConvId === conv.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50"
                }`}
                onClick={() => setCurrentConvId(conv.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{conv.title}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!currentConv ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <p className="text-2xl font-bold text-zinc-100 mb-4">
                No conversation selected
              </p>
              <button
                onClick={createNewChat}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition"
              >
                Start New Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="border-b border-zinc-800 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                {currentConv.title}
              </h2>
              {/* {currentConv.messages.length > 0 && (
                <button
                  onClick={saveConversationToPage}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-medium text-white transition flex items-center gap-2"
                >
                  <FaCopy size={12} />
                  Save Conversation
                </button>
              )} */}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {currentConv.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-zinc-500 text-center">
                    Start a conversation by typing a message below
                  </p>
                </div>
              ) : (
                <>
                  {currentConv.messages.map((msg) => {
                    const isTyping = typingMessageId === msg.id;
                    const displayContent =
                      msg.role === "assistant" && isTyping
                        ? typingContent || " "
                        : msg.content;

                    return (
                      <div key={msg.id} className="flex w-full justify-center">
                        <div
                          className={`w-full max-w-5xl px-6 py-3.5 rounded-2xl group relative text-sm leading-relaxed shadow-lg border ${
                            msg.role === "user"
                              ? "bg-blue-600/90 border-blue-500/60 text-white"
                              : "bg-zinc-900/80 border-zinc-800 text-zinc-100"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="prose prose-invert max-w-none text-sm">
                              <MarkdownRenderer content={displayContent} />
                              {isTyping && (
                                <span className="inline-block w-2 h-5 align-middle bg-blue-400 animate-pulse ml-1 rounded-sm" />
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap text-left">
                              {displayContent}
                            </p>
                          )}

                          {/* Message Actions - only for AI messages */}
                          {msg.role === "assistant" && (
                            <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 right-3 flex gap-1 bg-zinc-800/90 border border-zinc-700 rounded p-1 shadow-md">
                              <button
                                onClick={() =>
                                  copyToClipboard(msg.content, msg.id)
                                }
                                className="p-1.5 hover:bg-zinc-700 rounded transition"
                                title="Copy"
                              >
                                {copiedMessageId === msg.id ? (
                                  <FaCheck
                                    size={12}
                                    className="text-emerald-400"
                                  />
                                ) : (
                                  <FaCopy size={12} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isLoading && (
                    <div className="flex gap-2">
                      <div className="bg-zinc-800 px-3 py-2 rounded-lg">
                        <div className="flex gap-1.5">
                          <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                          <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-zinc-800 p-3 bg-zinc-900 space-y-2">
              {!isOllamaRunning && (
                <div className="p-2 bg-red-500/20 border border-red-500 rounded text-xs text-red-300">
                  ⚠️ Ollama is not running. Please start Ollama to use AI Chat.
                </div>
              )}

              {/* Uploaded Files Preview */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded text-xs border border-zinc-700"
                    >
                      <span className="text-blue-400">📎</span>
                      <span className="truncate max-w-[150px]">
                        {file.name}
                      </span>
                      <button
                        onClick={() => removeUploadedFile(index)}
                        className="ml-1 hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload image or PDF"
                  className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition flex items-center justify-center gap-2"
                >
                  <FaFileUpload size={16} />
                </button>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    isOllamaRunning
                      ? "Message AI..."
                      : "Ollama not connected..."
                  }
                  disabled={!isOllamaRunning || !selectedModel}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={sendMessage}
                  disabled={
                    isLoading ||
                    !inputValue.trim() ||
                    !isOllamaRunning ||
                    !selectedModel
                  }
                  className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition flex items-center justify-center"
                  title="Send message"
                >
                  <FaPaperPlane size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
