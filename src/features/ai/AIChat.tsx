import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FaPaperPlane } from "@react-icons/all-files/fa/FaPaperPlane";
import { FaCopy } from "@react-icons/all-files/fa/FaCopy";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaFileUpload } from "@react-icons/all-files/fa/FaFileUpload";
import { FaRobot } from "@react-icons/all-files/fa/FaRobot";
import { FaUser } from "@react-icons/all-files/fa/FaUser";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// @ts-ignore
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";
import { aiService } from "./aiService";
import { useChatStore } from "../../core/store/chatStore";
import { BackendType } from "./types";

export const AIChat = () => {
  const conversations = useChatStore((s) => s.conversations);
  const currentConvId = useChatStore((s) => s.activeConversationId);
  const addConversation = useChatStore((s) => s.addConversation);
  const addMessage = useChatStore((s) => s.addMessage);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [backend, setBackend] = useState<BackendType>("OpenAI");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typingContent, setTypingContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize PDF worker
  useEffect(() => {
    if (!(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
        /* @vite-ignore */ new URL(
          "pdfjs-dist/build/pdf.worker.min.js",
          import.meta.url,
        ).toString();
    }
  }, []);

  // Initialize: Ensure at least one conversation exists or select one
  useEffect(() => {
    if (conversations.length === 0 && !currentConvId) {
      // Don't auto-create here to avoid loops, sidebar handles creation
    } else if (conversations.length > 0 && !currentConvId) {
      setActiveConversation(conversations[0].id);
    }
  }, [conversations, currentConvId, setActiveConversation]);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      const cfg = await aiService.getState().catch(() => null);
      if (cfg) {
        setBackend(cfg.backend);
        if (cfg.model && !selectedModel) {
          setSelectedModel(cfg.model);
        }
      }

      const running = await aiService.healthCheck();
      setIsBackendHealthy(running);
      if (running) {
        const modelList = await aiService.listModels();
        setModels(modelList);
        if (modelList.length > 0 && !selectedModel) {
          const preferred =
            cfg?.model && modelList.includes(cfg.model)
              ? cfg.model
              : modelList[0];
          setSelectedModel(preferred);
        }
      }
    };
    loadModels();
    const interval = setInterval(loadModels, 10000);
    return () => clearInterval(interval);
  }, [selectedModel]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConvId, conversations, typingContent]);

  useEffect(() => {
    setTypingMessageId(null);
    setTypingContent("");
  }, [currentConvId]);

  // Typing effect
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

  const currentConv = conversations.find((c) => c.id === currentConvId);

  const sendMessage = async () => {
    if (
      !inputValue.trim() ||
      !currentConvId ||
      isLoading ||
      !isBackendHealthy ||
      !selectedModel
    )
      return;

    const filesContext = await buildFilesContext();
    const pageContext = await fetchPageContext();
    const messageText = inputValue;

    // Add User Message (UI-visible version — no tool defs)
    addMessage(currentConvId, {
      role: "user",
      content: messageText + (filesContext ? "\n\n[Attached Files]" : ""),
    });

    setInputValue("");
    setIsLoading(true);

    try {
      const conv = useChatStore
        .getState()
        .conversations.find((c) => c.id === currentConvId);
      const currentMessages = conv ? conv.messages : [];
      const historyForAI = currentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Build final messages array: system → history → user
      const messages: { role: string; content: string }[] = [];

      // SYSTEM message with tool definitions (never in user content)
      messages.push({
        role: "system",
        content: aiService.getToolDefinitions(),
      });

      // Conversation history
      messages.push(...historyForAI);

      // Current user message with context (but NO tool defs)
      messages.push({
        role: "user",
        content:
          messageText +
          (pageContext ? `\n${pageContext}` : "") +
          (filesContext ? `\n${filesContext}` : ""),
      });

      const response = await aiService.chat(messages, selectedModel, backend);

      // --- Hallucination guard ---
      if (aiService.isHallucination(response)) {
        addMessage(currentConvId, {
          role: "assistant",
          content:
            "I had trouble generating that. Please try rephrasing your request.",
        });
        return;
      }

      console.debug("🤖 AI Raw Response:", response);
      const parsed = aiService.extractJsonFromResponse(response);
      const commands = parsed?.commands ?? [];
      const textResponse = parsed?.textResponse ?? "";

      // Dispatch tool commands to the editor
      if (commands.length > 0) {
        for (const command of commands) {
          window.dispatchEvent(
            new CustomEvent("aiToolCommand", { detail: command }),
          );
        }
      }

      // Show the right message in the chat
      const didEditPage = commands.length > 0;

      if (didEditPage && textResponse) {
        addMessage(currentConvId, {
          role: "assistant",
          content: textResponse + "\n\n✅ Changes applied to the page.",
        });
      } else if (didEditPage) {
        addMessage(currentConvId, {
          role: "assistant",
          content: "✅ I've updated the page for you.",
        });
      } else {
        addMessage(currentConvId, {
          role: "assistant",
          content: textResponse || response || "No response content.",
        });
      }

      // Typing effect for the new message
      setTimeout(() => {
        const updatedConv = useChatStore
          .getState()
          .conversations.find((c) => c.id === currentConvId);
        const lastMsg = updatedConv?.messages[updatedConv.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          setTypingMessageId(lastMsg.id);
        }
      }, 50);

      setUploadedFiles([]);
    } catch (e) {
      console.error(e);
      addMessage(currentConvId, {
        role: "assistant",
        content: "Error: Failed to get response.",
      });
    } finally {
      setIsLoading(false);
    }
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
    let fullText = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return fullText;
  };

  const buildFilesContext = async () => {
    if (!uploadedFiles.length) return "";
    let ctx = "";
    for (const file of uploadedFiles) {
      if (file.type === "application/pdf") {
        const text = await extractPdfText(file);
        ctx += `\n\nFile: ${file.name}\n${text.slice(0, 5000)}...`;
      }
    }
    return ctx ? `\n\nContext from files:${ctx}` : "";
  };

  const fetchPageContext = async () => {
    let pageContent = "";
    try {
      const pageContentEvent = new CustomEvent("getPageContent");
      window.dispatchEvent(pageContentEvent);

      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const contentFromWindow = (window as any).__currentPageContent;
        if (contentFromWindow) {
          pageContent = contentFromWindow;
          delete (window as any).__currentPageContent;
          break;
        }
      }
    } catch (e) {
      console.warn("Could not fetch page content:", e);
    }

    return pageContent
      ? `\n\nCURRENT PAGE CONTENT:\n${pageContent.slice(0, 15000)}`
      : "";
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const copyToClipboard = (text: string, messageId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

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

  return (
    <div className="h-full flex flex-col bg-transparent text-slate-100 font-sans overflow-hidden relative">
      <div className="flex-1 flex flex-col relative z-0 min-h-0">
        {!currentConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center border border-white/10 backdrop-blur-3xl shadow-2xl">
                <FaRobot className="text-4xl text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">
                How can I help you today?
              </h2>
              <p className="text-zinc-400 mb-8">
                I can help you analyze documents, generate content, or answer
                questions.
              </p>
              <button
                onClick={addConversation}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-blue-500/25 hover:-translate-y-1"
              >
                Start Conversation
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md flex-shrink-0 z-10">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {currentConv.title}
              </h2>
              {/* Model Selector / Settings Toggle */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <div
                  className={`w-2 h-2 rounded-full ${isBackendHealthy ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar min-h-0 relative max-h-full">
              <div className="max-w-4xl mx-auto space-y-6">
                {currentConv.messages.map((msg) => {
                  const isTyping = typingMessageId === msg.id;
                  const displayContent =
                    msg.role === "assistant" && isTyping
                      ? typingContent || " "
                      : msg.content;
                  const isUser = msg.role === "user";

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0 flex items-center justify-center shadow-lg mt-1">
                          <FaRobot className="text-white text-xs" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-xl border backdrop-blur-sm ${
                          isUser
                            ? "bg-blue-600 text-white border-blue-500/50 rounded-tr-none"
                            : "bg-zinc-800/60 text-zinc-100 border-white/10 rounded-tl-none"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {displayContent}
                          </p>
                        ) : (
                          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                            <MarkdownRenderer content={displayContent} />
                            {isTyping && (
                              <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-1 rounded-full align-middle" />
                            )}
                          </div>
                        )}

                        {msg.role === "assistant" && !isTyping && (
                          <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() =>
                                copyToClipboard(msg.content, msg.id)
                              }
                              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md transition"
                            >
                              {copiedMessageId === msg.id ? (
                                <FaCheck className="text-emerald-400" />
                              ) : (
                                <FaCopy />
                              )}
                              Copy
                            </button>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center mt-1 border border-white/10">
                          <FaUser className="text-zinc-400 text-xs" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {isLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0 flex items-center justify-center shadow-lg mt-1">
                      <FaRobot className="text-white text-xs" />
                    </div>
                    <div className="bg-zinc-800/60 border border-white/10 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            {/* Input Floating Bar */}
            <div className="p-6">
              <div className="max-w-4xl mx-auto relative bg-zinc-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl ring-1 ring-white/5">
                {/* File Uploads Preview */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700/50 rounded-lg text-xs border border-white/10 group"
                      >
                        <span className="text-blue-400">📎</span>
                        <span className="text-zinc-300 truncate max-w-[120px]">
                          {file.name}
                        </span>
                        <button
                          onClick={() => removeUploadedFile(index)}
                          className="text-zinc-500 hover:text-red-400 transition ml-1"
                        >
                          <FaTrash size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
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
                    className="p-3 text-zinc-400 hover:text-blue-400 hover:bg-white/5 rounded-xl transition-all"
                    title="Upload files"
                  >
                    <FaFileUpload size={18} />
                  </button>

                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={
                      isBackendHealthy ? "Message AI..." : "Check connection..."
                    }
                    disabled={!isBackendHealthy || !selectedModel}
                    rows={1}
                    className="flex-1 bg-transparent border-none text-zinc-100 placeholder-zinc-500 focus:ring-0 resize-none py-3 max-h-32 text-sm leading-relaxed"
                    style={{ minHeight: "44px" }}
                  />

                  <button
                    onClick={sendMessage}
                    disabled={
                      isLoading || !inputValue.trim() || !isBackendHealthy
                    }
                    className={`p-3 rounded-xl transition-all duration-300 ${
                      inputValue.trim()
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 rotate-0"
                        : "bg-zinc-700 text-zinc-500 cursor-not-allowed rotate-0"
                    }`}
                  >
                    <FaPaperPlane
                      size={16}
                      className={isLoading ? "animate-pulse" : ""}
                    />
                  </button>
                </div>
              </div>
              <p className="text-center text-[10px] text-zinc-600 mt-3">
                AI can make mistakes. Please verify important information.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
