import { useEffect, useRef, useState, useCallback } from "react";
import {
  BlockNoteEditor,
  PartialBlock,
  BlockNoteSchema,
} from "@blocknote/core";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { usePageStore } from "../../core/store/pageStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getSharedDb } from "../../core/db/sqlite";
import { MathBlock } from "./MathBlock";
import { ImageBlock } from "./ImageBlock";
import { VideoBlock } from "./VideoBlock";
import { PdfBlock } from "./PdfBlock";
import { MermaidBlock } from "./MermaidBlock";
import { ChartBlock } from "./ChartBlock";
import { KanbanBlock } from "./KanbanBlock";
import { AudioBlock } from "./AudioBlock";
import { markdownToBlocks, htmlToMarkdown } from "./markdownParser";
import { AnimatePresence, motion } from "framer-motion";
import { FaCalculator } from "@react-icons/all-files/fa/FaCalculator";
import { FaImage } from "@react-icons/all-files/fa/FaImage";
import { FaVideo } from "@react-icons/all-files/fa/FaVideo";
import { FaFilePdf } from "@react-icons/all-files/fa/FaFilePdf";
import { FaLink } from "@react-icons/all-files/fa/FaLink";
import { FaProjectDiagram } from "@react-icons/all-files/fa/FaProjectDiagram";
import { FaChartBar } from "@react-icons/all-files/fa/FaChartBar";
import { FaTasks } from "@react-icons/all-files/fa/FaTasks";
import { FaSave } from "@react-icons/all-files/fa/FaSave";
import { FaMicrophone } from "@react-icons/all-files/fa/FaMicrophone";
import { FaChevronDown } from "@react-icons/all-files/fa/FaChevronDown";
import { FaPrint } from "@react-icons/all-files/fa/FaPrint";
import { FaFileCode } from "@react-icons/all-files/fa/FaFileCode";
import { FaHtml5 } from "@react-icons/all-files/fa/FaHtml5";
import {
  uploadFileFromPicker,
  uploadFileFromBytes,
  uploadFileFromPath,
} from "../../core/services/fileService";
import { useTemplateStore } from "../../core/store/templateStore";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const AUTOSAVE_DELAY = 1000;
const WEB_PAGE_CONTENT_STORAGE_KEY = "omni-web-page-content";

const PAGE_COVER_PRESETS = [
  {
    id: "aurora",
    label: "Aurora",
    style:
      "linear-gradient(135deg, rgba(14, 165, 233, 0.95) 0%, rgba(59, 130, 246, 0.72) 45%, rgba(168, 85, 247, 0.86) 100%)",
  },
  {
    id: "sunset",
    label: "Sunset",
    style:
      "linear-gradient(135deg, rgba(251, 146, 60, 0.95) 0%, rgba(244, 63, 94, 0.88) 55%, rgba(168, 85, 247, 0.82) 100%)",
  },
  {
    id: "forest",
    label: "Forest",
    style:
      "linear-gradient(135deg, rgba(22, 163, 74, 0.95) 0%, rgba(14, 116, 144, 0.78) 55%, rgba(15, 23, 42, 0.92) 100%)",
  },
  {
    id: "paper",
    label: "Paper",
    style:
      "linear-gradient(135deg, rgba(226, 232, 240, 0.96) 0%, rgba(148, 163, 184, 0.88) 48%, rgba(71, 85, 105, 0.9) 100%)",
  },
  {
    id: "midnight",
    label: "Midnight",
    style:
      "linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.9) 55%, rgba(59, 130, 246, 0.78) 100%)",
  },
] as const;

const resolveCoverStyle = (
  cover?: string | null,
): React.CSSProperties | null => {
  if (!cover) return null;

  const preset = PAGE_COVER_PRESETS.find((item) => item.id === cover);
  if (preset) {
    return { backgroundImage: preset.style };
  }

  if (/^(https?:|data:|blob:)/i.test(cover)) {
    return {
      backgroundImage: `url("${cover}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  return { backgroundImage: cover };
};

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

const loadWebPageContentMap = (): Record<string, PartialBlock[]> => {
  try {
    const raw = localStorage.getItem(WEB_PAGE_CONTENT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, PartialBlock[]>)
      : {};
  } catch {
    return {};
  }
};

const saveWebPageContentMap = (contentMap: Record<string, PartialBlock[]>) => {
  localStorage.setItem(
    WEB_PAGE_CONTENT_STORAGE_KEY,
    JSON.stringify(contentMap),
  );
};

const getWebPageContent = (pageId: string): PartialBlock[] => {
  const contentMap = loadWebPageContentMap();
  return Array.isArray(contentMap[pageId]) ? contentMap[pageId] : [];
};

const setWebPageContent = (pageId: string, content: PartialBlock[]) => {
  const contentMap = loadWebPageContentMap();
  contentMap[pageId] = content;
  saveWebPageContentMap(contentMap);
};

interface OmniEditorProps {
  onUpload?: (file: File) => Promise<string>;
  onSelectText?: (text: string) => void;
}

export const OmniEditor = ({ onUpload, onSelectText }: OmniEditorProps) => {
  useEffect(() => {
    if (onUpload) console.debug("Upload handler registered");
    if (onSelectText) console.debug("Text selection handler registered");
  }, [onUpload, onSelectText]);

  const activePageId = usePageStore((s) => s.activePageId);
  const currentPage = usePageStore((s) =>
    activePageId ? s.pages[activePageId] : undefined,
  );
  const updatePageTitle = usePageStore((s) => s.updatePageTitle);
  const updatePageCover = usePageStore((s) => s.updatePageCover);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [showImageUrlDialog, setShowImageUrlDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [exportToast, setExportToast] = useState<{
    title: string;
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const dragOverlayRef = useRef<HTMLDivElement>(null);
  const markdownImportInputRef = useRef<HTMLInputElement>(null);
  const [editor, setEditor] = useState<BlockNoteEditor<any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [aiPendingChanges, setAiPendingChanges] = useState(false);

  useEffect(() => {
    if (!exportToast) return;
    const timer = window.setTimeout(() => setExportToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [exportToast]);

  const showExportToast = (
    variant: "success" | "error",
    title: string,
    message: string,
  ) => {
    setExportToast({ variant, title, message });
  };

  const saveToDb = useCallback(
    async (content: PartialBlock[], pageId: string) => {
      try {
        if (!isTauriRuntime()) {
          setWebPageContent(pageId, content);
          return;
        }

        const db = await getSharedDb();
        const json = JSON.stringify(content);
        const existing = await db.select<any[]>(
          "SELECT id FROM blocks WHERE page_id = $1",
          [pageId],
        );
        if (existing.length > 0) {
          await db.execute(
            "UPDATE blocks SET content = $1 WHERE page_id = $2",
            [json, pageId],
          );
        } else {
          await db.execute(
            "INSERT INTO blocks (id, page_id, content, sort_order) VALUES ($1, $2, $3, $4)",
            [crypto.randomUUID(), pageId, json, 0],
          );
        }
      } catch (e) {
        console.error(e);
      }
    },
    [],
  );

  const debouncedSave = useCallback(
    (content: PartialBlock[], pageId: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(
        () => saveToDb(content, pageId),
        AUTOSAVE_DELAY,
      ) as unknown as number;
    },
    [saveToDb],
  );

  useEffect(() => {
    if (!activePageId) return;

    const loadContent = async () => {
      setIsLoading(true);
      setEditor(null);
      try {
        let loaded: PartialBlock[] = [];
        if (isTauriRuntime()) {
          const db = await getSharedDb();
          const rows = await db.select<any[]>(
            "SELECT content FROM blocks WHERE page_id = $1",
            [activePageId],
          );
          if (rows.length > 0) {
            try {
              loaded = JSON.parse(rows[0].content);
            } catch (e) {
              console.error("Bad JSON", e);
            }
          }
        } else {
          loaded = getWebPageContent(activePageId);
        }

        const defaultSchema = BlockNoteSchema.create();
        const schema = BlockNoteSchema.create({
          blockSpecs: {
            ...defaultSchema.blockSpecs,
            math: MathBlock(),
            image: ImageBlock(),
            video: VideoBlock(),
            pdf: PdfBlock(),
            mermaid: MermaidBlock(),
            chart: ChartBlock(),
            kanban: KanbanBlock(),
            audio: AudioBlock(),
          },
          styleSpecs: defaultSchema.styleSpecs,
        }) as any;

        setEditor(
          BlockNoteEditor.create({
            initialContent: loaded.length > 0 ? loaded : undefined,
            schema,
          }) as any,
        );
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [activePageId]);

  const handleFileUpload = async (fileType: "image" | "video" | "pdf") => {
    if (!editor || !activePageId) return;
    if (!isTauriRuntime()) {
      alert("File uploads are available in the desktop app only.");
      return;
    }

    try {
      const assetInfo = await uploadFileFromPicker(activePageId);
      if (!assetInfo) return;

      const blockType =
        fileType === "image" ? "image" : fileType === "video" ? "video" : "pdf";
      const blockProps: any = {
        assetId: assetInfo.id,
        filePath: assetInfo.file_path,
        fileName: assetInfo.file_name,
      };
      if (blockType === "image") {
        blockProps.width = 100;
        blockProps.alt = assetInfo.file_name;
      } else if (blockType === "video") blockProps.width = 100;
      else blockProps.height = 600;

      editor.insertBlocks(
        [{ type: blockType, props: blockProps }],
        editor.getTextCursorPosition().block,
        "after",
      );
    } catch (error) {
      console.error("Failed to upload file:", error);
      alert("Failed to upload file: " + error);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!editor || !templateName.trim()) return;
    try {
      await createTemplate(
        templateName,
        templateDescription,
        editor.document,
        "📄",
      );
      setShowSaveTemplateDialog(false);
      setTemplateName("");
      setTemplateDescription("");
      alert("Template saved successfully!");
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("Failed to save template: " + error);
    }
  };

  const handleChange = () => {
    if (editor && activePageId) {
      debouncedSave(editor.document, activePageId);
    }
  };

  const applyParsedMarkdown = (markdown: string) => {
    if (!editor || !activePageId) return;

    const parsedBlocks = markdownToBlocks(markdown);
    const nextBlocks: PartialBlock[] =
      parsedBlocks.length > 0
        ? parsedBlocks
        : [
            {
              type: "paragraph",
              content: markdown.trim() || "",
            } as any,
          ];

    const existingBlockIds = editor.document.map((block) => block.id);
    if (existingBlockIds.length > 0) {
      editor.removeBlocks(existingBlockIds);
    }

    const anchor = editor.document[0];
    if (anchor) {
      editor.updateBlock(anchor, nextBlocks[0] as any);
      if (nextBlocks.length > 1) {
        editor.insertBlocks(nextBlocks.slice(1), anchor, "after");
      }
    }

    debouncedSave(editor.document, activePageId);
  };

  const handleImportMarkdownFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const markdown = await file.text();
      applyParsedMarkdown(markdown);

      const suggestedTitle = file.name.replace(/\.md$/i, "").trim();
      if (suggestedTitle && activePageId) {
        updatePageTitle(activePageId, suggestedTitle);
      }
    } catch (error) {
      console.error("Failed to import markdown file:", error);
      alert("Failed to open markdown file.");
    } finally {
      event.target.value = "";
    }
  };

  // Handle Paste
  const handlePaste = async (event: React.ClipboardEvent) => {
    if (!editor || !activePageId) return;

    const target = event.target as HTMLElement | null;
    const isNativeTextInput = Boolean(
      target?.closest("input, textarea, [contenteditable='false']"),
    );

    // Allow native paste behavior for title input and custom block textareas.
    if (isNativeTextInput) {
      return;
    }

    // Check for image files first
    const items = event.clipboardData.items;
    let handledImage = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;

        handledImage = true;
        try {
          const bytes = await file.arrayBuffer();
          const extension = file.name
            ? file.name.split(".").pop() || "png"
            : "png";
          const fileName =
            file.name || `pasted_image_${Date.now()}.${extension}`;

          const assetInfo = await uploadFileFromBytes(
            bytes,
            fileName,
            extension,
            activePageId,
          );

          editor.insertBlocks(
            [
              {
                type: "image",
                props: {
                  assetId: assetInfo.id,
                  filePath: assetInfo.file_path,
                  fileName: assetInfo.file_name,
                  width: 100,
                  alt: assetInfo.file_name,
                },
              },
            ],
            editor.getTextCursorPosition().block,
            "after",
          );
        } catch (error) {
          console.error("Paste upload failed:", error);
        }
      }
    }

    // If no image handled, check for HTML content (e.g. from Slides/GPT/Gemini)
    if (!handledImage) {
      const html = event.clipboardData.getData("text/html");
      const plainText = event.clipboardData.getData("text/plain");

      if (html) {
        event.preventDefault(); // Stop default paste
        const markdown = htmlToMarkdown(html);
        console.debug("HTML detected - converted to markdown:", {
          original: html.substring(0, 200),
          markdown: markdown.substring(0, 200),
        });

        const blocks = markdownToBlocks(markdown);
        if (blocks.length > 0) {
          console.debug(`Created ${blocks.length} blocks from HTML`);
          editor.insertBlocks(
            blocks,
            editor.getTextCursorPosition().block,
            "after",
          );
          return; // Successfully handled
        }
      }

      // For plain text, rely on BlockNote native paste behavior.
      // This avoids duplicate insertion when both native and custom handlers run.
      if (plainText) {
        return;
      }
    }
  };

  // Handle Drag and Drop from Tauri
  useEffect(() => {
    if (!editor || !activePageId) return;
    if (!isTauriRuntime()) return;

    const unlisten = getCurrentWindow().listen<{ paths: string[] }>(
      "tauri://drag-drop",
      async (event) => {
        const { paths } = event.payload;
        for (const filePath of paths) {
          const extension = filePath.split(".").pop()?.toLowerCase() || "";
          const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(
            extension,
          );
          const isVideo = ["mp4", "webm", "mov"].includes(extension);
          const isPdf = extension === "pdf";

          if (isImage || isVideo || isPdf) {
            try {
              const assetInfo = await uploadFileFromPath(
                filePath,
                activePageId,
              );

              const blockType = isImage ? "image" : isVideo ? "video" : "pdf";
              const blockProps: any = {
                assetId: assetInfo.id,
                filePath: assetInfo.file_path,
                fileName: assetInfo.file_name,
              };

              if (blockType === "image") {
                blockProps.width = 100;
                blockProps.alt = assetInfo.file_name;
              } else if (blockType === "video") {
                blockProps.width = 100;
              } else {
                blockProps.height = 600;
              }

              editor.insertBlocks(
                [
                  {
                    type: blockType,
                    props: blockProps,
                  },
                ],
                editor.getTextCursorPosition().block,
                "after",
              );
            } catch (e) {
              console.error("Drag-drop upload failed:", e);
            }
          }
        }
      },
    );

    return () => {
      unlisten.then((f) => f());
    };
  }, [editor, activePageId]);

  // Expose editor snapshot for the AI undo system
  useEffect(() => {
    if (!editor) return;
    (window as any).__editorSnapshot = editor.document;
    const unsubscribe = editor.onChange(() => {
      (window as any).__editorSnapshot = editor.document;
    });
    return () => unsubscribe?.();
  }, [editor]);

  // Respond to getPageContent event (for AI panel context)
  useEffect(() => {
    if (!editor) return;
    const handleGetContent = () => {
      const blocks = editor.document;
      const md = blocks
        .map((block: any) => {
          const text =
            typeof block.content === "string"
              ? block.content
              : Array.isArray(block.content)
              ? block.content.map((s: any) => s.text ?? "").join("")
              : "";
          switch (block.type) {
            case "heading":
              return `${'#'.repeat(block.props?.level ?? 1)} ${text}`;
            case "bulletListItem":
              return `- ${text}`;
            case "numberedListItem":
              return `1. ${text}`;
            case "mermaid":
              return `[mermaid]: ${block.props?.code ?? ""}`;
            case "math":
              return `[math]: ${block.props?.latex ?? ""}`;
            default:
              return text;
          }
        })
        .join("\n");
      (window as any).__currentPageContent = md;
    };
    window.addEventListener("getPageContent", handleGetContent);
    return () => window.removeEventListener("getPageContent", handleGetContent);
  }, [editor]);

  // Handle AI Tool Commands (DOM event — works in both Tauri & web)
  useEffect(() => {
    if (!editor || !activePageId) return;

    const applyCommand = (action: string, params: Record<string, any>) => {
      if (action === "insert_block") {
        const blocks = editor.document;
        const anchor = blocks[blocks.length - 1];
        const newBlock: any = {
          type: params.type || "paragraph",
          content: params.content || "",
        };
        if (params.level) newBlock.props = { level: params.level };
        if (anchor) {
          editor.insertBlocks([newBlock], anchor, "after");
        }
        setAiPendingChanges(true);
      } else if (action === "replace_all" && params.markdown) {
        const parsed = markdownToBlocks(params.markdown as string);
        const next =
          parsed.length > 0
            ? parsed
            : [{ type: "paragraph", content: params.markdown }];
        const existing = editor.document.map((b: any) => b.id);
        if (existing.length > 0) editor.removeBlocks(existing);
        const first = editor.document[0];
        if (first) {
          editor.updateBlock(first, next[0] as any);
          if (next.length > 1) editor.insertBlocks(next.slice(1), first, "after");
        } else {
          editor.insertBlocks(next, editor.document[0] ?? null, "after");
        }
        debouncedSave(editor.document, activePageId);
        setAiPendingChanges(true);
      } else if (action === "replace_text" && params.find && params.replace !== undefined) {
        const blocks = editor.document;
        blocks.forEach((block: any) => {
          if (Array.isArray(block.content)) {
            const full = block.content.map((s: any) => s.text ?? "").join("");
            if (full.includes(params.find as string)) {
              editor.updateBlock(block, {
                content: full.replace(params.find as string, params.replace as string),
              } as any);
            }
          }
        });
        setAiPendingChanges(true);
      }
    };

    // DOM-based listener (used by AiAgentPanel)
    const handleDomCommand = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; params: Record<string, any> }>).detail;
      if (!detail) return;
      try {
        applyCommand(detail.action, detail.params);
      } catch (err) {
        console.error("AI DOM command error:", err);
      }
    };

    window.addEventListener("aiToolCommand", handleDomCommand);

    // Tauri event listener (from Rust bridge) — uses dynamic import to avoid ESM issues
    let tauriUnlisten: (() => void) | null = null;
    if (isTauriRuntime()) {
      import("@tauri-apps/api/event").then(({ listen: tauriListen }) => {
        tauriListen<any>("aiToolCommand", (event: any) => {
          try {
            const payload =
              typeof event.payload === "string"
                ? JSON.parse(event.payload)
                : event.payload;
            applyCommand(payload.action, payload.params ?? {});
          } catch (e) {
            console.error("Failed to parse Tauri AI Tool Command", e);
          }
        }).then((fn: () => void) => {
          tauriUnlisten = fn;
        });
      });
    }

    // Undo handler — restores editor to a previous snapshot
    const handleUndo = (e: Event) => {
      const snapshot = (e as CustomEvent<{ snapshot: any[] }>).detail?.snapshot;
      if (!snapshot || !Array.isArray(snapshot)) return;
      try {
        const existing = editor.document.map((b: any) => b.id);
        if (existing.length > 0) editor.removeBlocks(existing);
        const first = editor.document[0];
        if (first && snapshot.length > 0) {
          editor.updateBlock(first, snapshot[0] as any);
          if (snapshot.length > 1)
            editor.insertBlocks(snapshot.slice(1), first, "after");
        }
        debouncedSave(editor.document, activePageId);
        setAiPendingChanges(false);
      } catch (err) {
        console.error("AI undo error:", err);
      }
    };
    window.addEventListener("aiUndoChange", handleUndo);

    return () => {
      window.removeEventListener("aiToolCommand", handleDomCommand);
      window.removeEventListener("aiUndoChange", handleUndo);
      tauriUnlisten?.();
    };
  }, [editor, activePageId, debouncedSave]);

  // Handle Insert Image from URL
  const handleInsertImageUrl = () => {
    if (!editor) return;
    setShowImageUrlDialog(true);
  };

  const confirmInsertImageUrl = () => {
    if (editor && imageUrl.trim()) {
      editor.insertBlocks(
        [
          {
            type: "image",
            props: {
              url: imageUrl.trim(),
              width: 100,
            },
          },
        ],
        editor.getTextCursorPosition().block,
        "after",
      );
      setShowImageUrlDialog(false);
      setImageUrl("");
    }
  };

  const exportToPdf = async () => {
    const editorElement = document.querySelector(".bn-editor") as HTMLElement;
    if (!editorElement) {
      console.error("Editor element not found");
      return;
    }

    const applyExportStyles = (root: HTMLElement) => {
      const previousStyles = {
        color: root.style.color,
        backgroundColor: root.style.backgroundColor,
        width: root.style.width,
        maxWidth: root.style.maxWidth,
        margin: root.style.margin,
        padding: root.style.padding,
      };

      root.style.color = "#111111";
      root.style.backgroundColor = "#ffffff";
      root.classList.add("export-to-pdf");
      root.style.width = "100%";
      root.style.maxWidth = "980px";
      root.style.margin = "0 auto";
      root.style.padding = "56px 64px 80px";

      const styleTag = document.createElement("style");
      styleTag.setAttribute("data-export-style", "true");
      styleTag.textContent = `
        .export-to-pdf, .export-to-pdf * {
          color: #111111 !important;
          background-color: transparent !important;
        }
        .export-to-pdf pre, .export-to-pdf code {
          background: #f4f4f5 !important;
          color: #111111 !important;
          border: 1px solid #e4e4e7 !important;
          border-radius: 12px !important;
          white-space: pre-wrap !important;
          word-break: break-word !important;
        }
        .export-to-pdf table {
          color: #111111 !important;
          border-collapse: collapse !important;
        }
        .export-to-pdf img,
        .export-to-pdf svg,
        .export-to-pdf canvas,
        .export-to-pdf iframe {
          max-width: 100% !important;
        }
        .export-to-pdf .bn-editor {
          max-width: 760px !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }
        .export-to-pdf .omni-page-shell {
          max-width: 760px !important;
          margin: 0 auto !important;
        }
        .export-to-pdf .omni-page-cover {
          box-shadow: none !important;
        }
      `;

      document.head.appendChild(styleTag);

      return () => {
        root.style.color = previousStyles.color;
        root.style.backgroundColor = previousStyles.backgroundColor;
        root.style.width = previousStyles.width;
        root.style.maxWidth = previousStyles.maxWidth;
        root.style.margin = previousStyles.margin;
        root.style.padding = previousStyles.padding;
        root.classList.remove("export-to-pdf");
        styleTag.remove();
      };
    };

    const hideEmptyBlocksForExport = (root: HTMLElement) => {
      const blockElements = Array.from(
        root.querySelectorAll<HTMLElement>(".bn-block"),
      );
      const targets =
        blockElements.length > 0
          ? blockElements
          : Array.from(root.querySelectorAll<HTMLElement>("[data-id]"));

      const hiddenBlocks: Array<{
        element: HTMLElement;
        previousDisplay: string;
      }> = [];

      const hasMeaningfulContent = (element: HTMLElement) => {
        const contentElement =
          element.querySelector<HTMLElement>(
            ".bn-block-content, .bn-inline-content",
          ) ?? element;

        const text = (contentElement.textContent || "")
          .replace(/\u200B/g, "")
          .trim();

        if (text.length > 0) return true;

        return Boolean(
          contentElement.querySelector(
            "img, video, audio, iframe, svg, canvas, table, pre, code, blockquote, hr, ul, ol, li, .katex",
          ),
        );
      };

      targets.forEach((element) => {
        if (!hasMeaningfulContent(element)) {
          hiddenBlocks.push({
            element,
            previousDisplay: element.style.display,
          });
          element.style.display = "none";
          element.setAttribute("data-export-hidden", "true");
        }
      });

      return () => {
        hiddenBlocks.forEach(({ element, previousDisplay }) => {
          element.style.display = previousDisplay;
          element.removeAttribute("data-export-hidden");
        });
      };
    };

    let restoreHiddenBlocks: (() => void) | null = null;
    let restoreExportStyles: (() => void) | null = null;

    try {
      restoreExportStyles = applyExportStyles(editorElement);
      restoreHiddenBlocks = hideEmptyBlocksForExport(editorElement);

      const canvas = await html2canvas(editorElement, {
        scale: 2.25,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff", // Ensure white background
        windowWidth: Math.max(editorElement.scrollWidth, 1100),
        windowHeight: editorElement.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const renderedHeight = (canvas.height * contentWidth) / canvas.width;
      const pageCount = Math.max(1, Math.ceil(renderedHeight / contentHeight));

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        if (pageIndex > 0) pdf.addPage();

        const sourceY = Math.round(
          (pageIndex * contentHeight * canvas.width) / contentWidth,
        );
        const sourceHeight = Math.min(
          Math.round((contentHeight * canvas.width) / contentWidth),
          canvas.height - sourceY,
        );

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;

        const pageContext = pageCanvas.getContext("2d");
        if (!pageContext) continue;

        pageContext.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight,
        );

        const pageImgData = pageCanvas.toDataURL("image/png");
        const pageDrawHeight = (sourceHeight * contentWidth) / canvas.width;
        pdf.addImage(
          pageImgData,
          "PNG",
          margin,
          margin,
          contentWidth,
          pageDrawHeight,
        );
      }

      const pages = usePageStore.getState().pages;
      const title = activePageId ? pages[activePageId]?.title : "Document";
      const safeTitle =
        title
          .trim()
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-+|-+$/g, "") || "document";
      pdf.save(`${safeTitle}.pdf`);
      showExportToast(
        "success",
        "PDF exported",
        `${title}.pdf was created successfully.`,
      );
    } catch (error) {
      console.error("PDF export failed:", error);
      showExportToast(
        "error",
        "Export failed",
        error instanceof Error ? error.message : "Failed to export PDF.",
      );
    } finally {
      restoreExportStyles?.();
      restoreHiddenBlocks?.();
    }
  };

  // Drag-to-select handlers - disabled to avoid interference with normal editor interactions
  const handleMouseDown = () => {
    // Drag box selection is disabled to prevent conflicts with:
    // - Normal text selection in the editor
    // - Card drag-and-drop operations
    // - Click interactions with buttons and controls
  };

  const handleMouseMove = () => {
    // Drag selection disabled
  };

  const handleMouseUp = () => {
    // Drag selection disabled
    // No longer triggering AI panel on any text selection
  };

  // Handle Title Change? BlockNote doesn't manage page title.
  // We can add a Title Input above the editor.

  // Custom Dark Theme to match Zinc-950 (#09090b)
  const darkTheme = {
    colors: {
      editor: {
        text: "#ffffff",
        background: "#09090b", // zinc-950
      },
      menu: {
        text: "#ffffff",
        background: "#18181b", // zinc-900 (Lighter than bg for contrast)
      },
      tooltip: {
        text: "#ffffff",
        background: "#18181b",
      },
      hovered: {
        text: "#ffffff",
        background: "#27272a", // zinc-800
      },
      selected: {
        text: "#ffffff",
        background: "#27272a",
      },
      disabled: {
        text: "#a1a1aa",
        background: "#18181b",
      },
      shadow: "#18181b",
      border: "#27272a",
      sideMenu: "#71717a", // Color of the drag handle icon (zinc-500 for better visibility)
      highlights: {
        gray: { text: "#9b9a97", background: "transparent" },
        brown: { text: "#64473a", background: "transparent" },
        orange: { text: "#d9730d", background: "transparent" },
        yellow: { text: "#dfab01", background: "transparent" },
        green: { text: "#0f7b6c", background: "transparent" },
        blue: { text: "#0b6e99", background: "transparent" },
        purple: { text: "#6940a5", background: "transparent" },
        pink: { text: "#ad1a72", background: "transparent" },
        red: { text: "#e03e3e", background: "transparent" },
      },
    },
    borderRadius: 4,
    fontFamily: "Inter, sans-serif",
  };

  if (!activePageId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400">
        Select a page
      </div>
    );
  }

  if (isLoading || !editor) {
    return <div className="p-10 text-zinc-400">Loading...</div>;
  }

  const coverStyle = resolveCoverStyle(currentPage?.cover);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full bg-white dark:bg-zinc-950 px-4 py-6 relative"
      style={{ scrollBehavior: "smooth" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onPaste={handlePaste}
    >
      <AnimatePresence>
        {exportToast && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-5 right-5 z-[80] pointer-events-none"
          >
            <div
              className={`pointer-events-auto w-[340px] rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
                exportToast.variant === "success"
                  ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-cyan-500/15 text-emerald-50 shadow-emerald-900/30"
                  : "border-rose-400/30 bg-gradient-to-br from-rose-500/20 via-red-500/15 to-orange-500/15 text-rose-50 shadow-rose-900/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                  <FaPrint size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {exportToast.title}
                  </div>
                  <div className="mt-1 text-xs leading-5 opacity-90">
                    {exportToast.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExportToast(null)}
                  className="pointer-events-auto rounded-lg px-2 py-1 text-xs opacity-70 transition hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="omni-page-shell space-y-5">
        {false && (
          <div
            ref={dragOverlayRef}
            className="fixed pointer-events-none z-40 bg-blue-500/20 border-2 border-blue-500 rounded"
            style={{ left: "0px", top: "0px", width: "0px", height: "0px" }}
          />
        )}

        {coverStyle && (
          <div className="omni-page-cover no-print">
            <div className="omni-page-cover-surface" style={coverStyle} />
          </div>
        )}

        <div className="flex flex-wrap justify-between items-start gap-4 no-print">
          <input
            className="min-w-0 flex-1 text-4xl font-bold text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-300 border-none outline-none bg-transparent px-0"
            placeholder="Untitled"
            defaultValue={currentPage?.title || ""}
            onChange={(e) => updatePageTitle(activePageId, e.target.value)}
            onPaste={(e) => e.stopPropagation()}
          />

          <div className="flex flex-wrap gap-2">
            <input
              ref={markdownImportInputRef}
              type="file"
              accept=".md,text/markdown,text/plain"
              className="hidden"
              onChange={handleImportMarkdownFile}
            />

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => markdownImportInputRef.current?.click()}
              className="px-3 py-2 text-zinc-100 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition flex items-center gap-1 shadow-md"
              title="Open Markdown file"
            >
              <FaFileCode size={14} />
              Open .md
            </motion.button>

            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCoverPicker((value) => !value)}
                className="px-3 py-2 text-zinc-100 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition flex items-center gap-1 shadow-md"
                title="Choose page cover"
              >
                <FaImage size={14} />
                Cover
              </motion.button>

              {showCoverPicker && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-3 z-50">
                  <div className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 mb-3">
                    Page Cover
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PAGE_COVER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          updatePageCover(activePageId, preset.id);
                          setShowCoverPicker(false);
                        }}
                        className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 text-left hover:scale-[1.01] transition"
                      >
                        <div
                          className="h-20 w-full"
                          style={{ backgroundImage: preset.style }}
                        />
                        <div className="px-2 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          {preset.label}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={coverUrlInput}
                      onChange={(e) => setCoverUrlInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      placeholder="Paste cover image URL"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const nextCover = coverUrlInput.trim();
                          if (!nextCover) return;
                          updatePageCover(activePageId, nextCover);
                          setShowCoverPicker(false);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                      >
                        Use URL
                      </button>
                      <button
                        onClick={() => {
                          updatePageCover(activePageId, null);
                          setShowCoverPicker(false);
                          setCoverUrlInput("");
                        }}
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSaveTemplateDialog(true)}
              className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition flex items-center gap-1 shadow-md"
              title="Save as Template"
            >
              <FaSave size={14} />
              Save as Template
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                if (!editor || !editor.document) return;
                const markdown = await editor.blocksToMarkdownLossy(
                  editor.document,
                );
                const blocks = markdownToBlocks(markdown);
                if (blocks.length > 0) {
                  editor.removeBlocks(editor.document.map((block) => block.id));
                  const anchor = editor.document[0];
                  if (anchor) {
                    editor.updateBlock(anchor, blocks[0]);
                    if (blocks.length > 1) {
                      editor.insertBlocks(blocks.slice(1), anchor, "after");
                    }
                  }
                }
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:shadow-blue-500/10 border border-transparent hover:border-white/5"
              title="Reformat this page as markdown"
            >
              <FaSave size={14} className="text-zinc-300" />
              Reformat
            </motion.button>

            <div className="relative group z-50">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-black/20"
              >
                Export
                <FaChevronDown className="text-xs text-zinc-400 group-hover:rotate-180 transition-transform duration-300" />
              </motion.button>

              <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right scale-95 group-hover:scale-100">
                <button
                  onClick={exportToPdf}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition flex items-center gap-3"
                >
                  <FaPrint className="text-zinc-500" />
                  <span>Export to PDF</span>
                </button>

                <button
                  onClick={async () => {
                    const markdown = await editor?.blocksToMarkdownLossy(
                      editor.document,
                    );
                    if (!markdown) return;
                    const blob = new Blob([markdown], {
                      type: "text/markdown",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${currentPage?.title || "document"}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition flex items-center gap-3"
                >
                  <FaFileCode className="text-blue-500" />
                  <span>Export Markdown</span>
                </button>

                <button
                  onClick={async () => {
                    const html = await editor?.blocksToHTMLLossy(
                      editor.document,
                    );
                    if (!html) return;
                    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${currentPage?.title || "Document"}</title><style>body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a1a; line-height: 1.6; } pre { background: #f4f4f5; padding: 15px; border-radius: 8px; overflow-x: auto; } img { max-width: 100%; height: auto; border-radius: 8px; } blockquote { border-left: 4px solid #e4e4e7; padding-left: 15px; margin-left: 0; color: #52525b; }</style></head><body><h1>${currentPage?.title || "Document"}</h1>${html}</body></html>`;
                    const blob = new Blob([fullHtml], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${currentPage?.title || "document"}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition flex items-center gap-3"
                >
                  <FaHtml5 className="text-orange-500" />
                  <span>Export HTML</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-[70vh] pb-[50vh]">
          <BlockNoteView
            editor={editor}
            onChange={handleChange}
            theme={darkTheme}
            slashMenu={false}
            spellCheck={true}
          >
            <SuggestionMenuController
              triggerCharacter={"/"}
              getItems={async (query) => {
                const items = [
                  ...getDefaultReactSlashMenuItems(editor),
                  {
                    title: "Math",
                    onItemClick: () => {
                      editor.insertBlocks(
                        [
                          {
                            type: "math",
                          },
                        ],
                        editor.getTextCursorPosition().block,
                        "after",
                      );
                    },
                    aliases: ["latex", "equation", "formula"],
                    group: "Other",
                    icon: <FaCalculator />,
                    subtext: "Insert a LaTeX math block",
                  },
                  {
                    title: "Mermaid Diagram",
                    onItemClick: () => {
                      editor.insertBlocks(
                        [
                          {
                            type: "mermaid",
                          },
                        ],
                        editor.getTextCursorPosition().block,
                        "after",
                      );
                    },
                    aliases: ["flowchart", "diagram", "architecture", "erd"],
                    group: "Visuals",
                    icon: <FaProjectDiagram />,
                    subtext:
                      "Insert a Mermaid diagram (flowchart, sequence, ER)",
                  },
                  {
                    title: "Chart",
                    onItemClick: () => {
                      editor.insertBlocks(
                        [
                          {
                            type: "chart",
                          },
                        ],
                        editor.getTextCursorPosition().block,
                        "after",
                      );
                    },
                    aliases: ["bar", "line", "pie", "graph"],
                    group: "Visuals",
                    icon: <FaChartBar />,
                    subtext: "Insert a chart (bar, line, pie)",
                  },
                  {
                    title: "Kanban Board",
                    onItemClick: () => {
                      editor.insertBlocks(
                        [
                          {
                            type: "kanban",
                          },
                        ],
                        editor.getTextCursorPosition().block,
                        "after",
                      );
                    },
                    aliases: ["task", "board", "jira", "trello"],
                    group: "Productivity",
                    icon: <FaTasks />,
                    subtext: "Task management board",
                  },
                  {
                    title: "Upload Photo",
                    onItemClick: () => handleFileUpload("image"),
                    aliases: ["img", "picture", "photo"],
                    group: "Images",
                    icon: <FaImage />,
                    subtext: "Upload and insert an image",
                  },
                  {
                    title: "Image from URL",
                    onItemClick: () => handleInsertImageUrl(),
                    aliases: ["url", "link", "external"],
                    group: "Images",
                    icon: <FaLink />,
                    subtext: "Insert an image from a web URL",
                  },
                  {
                    title: "Upload Video",
                    onItemClick: () => handleFileUpload("video"),
                    aliases: ["movie", "clip"],
                    group: "Videos",
                    icon: <FaVideo />,
                    subtext: "Upload and insert a video file",
                  },
                  {
                    title: "Embed PDF",
                    onItemClick: () => handleFileUpload("pdf"),
                    aliases: ["document", "file"],
                    group: "Documents",
                    icon: <FaFilePdf />,
                    subtext: "Upload and embed a PDF document",
                  },
                  {
                    title: "Audio Recording",
                    onItemClick: () => {
                      editor.insertBlocks(
                        [
                          {
                            type: "audio",
                          },
                        ],
                        editor.getTextCursorPosition().block,
                        "after",
                      );
                    },
                    aliases: ["record", "voice", "sound", "microphone"],
                    group: "Audio",
                    icon: <FaMicrophone />,
                    subtext: "Record or upload audio",
                  },
                ];

                return items.filter((item: any) => {
                  const lowerQuery = query.toLowerCase();
                  return (
                    item.title?.toLowerCase().includes(lowerQuery) ||
                    (item.aliases &&
                      item.aliases.some((alias: string) =>
                        alias.toLowerCase().includes(lowerQuery),
                      ))
                  );
                });
              }}
            />
          </BlockNoteView>
        </div>
      </div>

      {/* Save as Template Dialog */}
      {showSaveTemplateDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FaSave className="text-blue-500" />
              Save as Template
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="Enter template name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="Enter template description"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => {
                    setShowSaveTemplateDialog(false);
                    setTemplateName("");
                    setTemplateDescription("");
                  }}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={!templateName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image URL Dialog */}
      {showImageUrlDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FaLink className="text-blue-500" />
              Insert Image URL
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Image Web Address
                </label>
                <input
                  type="text"
                  autoFocus
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmInsertImageUrl();
                    if (e.key === "Escape") setShowImageUrlDialog(false);
                  }}
                  className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="https://example.com/image.png"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Paste a direct link to an image (jpg, png, gif, webp).
                </p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => {
                    setShowImageUrlDialog(false);
                    setImageUrl("");
                  }}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmInsertImageUrl}
                  disabled={!imageUrl.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                  Insert Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Changes Action Bar */}
      {aiPendingChanges && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-zinc-800 border border-blue-500/30 shadow-2xl shadow-blue-500/20 rounded-full px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            ✨ AI updated the page
          </span>
          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700"></div>
          <button
            onClick={() => {
              editor?.undo();
              setAiPendingChanges(false);
            }}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Undo
          </button>
          <button
            onClick={() => setAiPendingChanges(false)}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Accept
          </button>
        </div>
      )}
    </motion.div>
  );
};
