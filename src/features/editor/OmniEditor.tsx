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
import Database from "@tauri-apps/plugin-sql";
import { DB_URL } from "../../core/db/sqlite";
import { MathBlock } from "./MathBlock";
import { ImageBlock } from "./ImageBlock";
import { VideoBlock } from "./VideoBlock";
import { PdfBlock } from "./PdfBlock";
import { MermaidBlock } from "./MermaidBlock";
import { ChartBlock } from "./ChartBlock";
import { KanbanBlock } from "./KanbanBlock";
import { AudioBlock } from "./AudioBlock";
import { markdownToBlocks, htmlToMarkdown } from "./markdownParser";
import { aiAnimator } from "../ai/aiEditorAnimations";
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
// I will implement a custom debounce or just setTimeout.
// Or I can install `use-debounce`. I'll do custom ref.

const AUTOSAVE_DELAY = 1000;

interface OmniEditorProps {
  onUpload?: (file: File) => Promise<string>;
  onAISuggest?: (context: string) => Promise<string>;
  onSelectText?: (text: string) => void;
}

export const OmniEditor = ({
  onUpload,
  onAISuggest,
  onSelectText,
}: OmniEditorProps) => {
  // Dormant hooks stub - logging to satisfy linter until implemented
  useEffect(() => {
    if (onUpload) console.debug("Upload handler registered");
    if (onAISuggest) console.debug("AI handler registered");
    if (onSelectText) console.debug("Text selection handler registered");
  }, [onUpload, onAISuggest, onSelectText]);

  const activePageId = usePageStore((s) => s.activePageId);
  const updatePageTitle = usePageStore((s) => s.updatePageTitle);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [showImageUrlDialog, setShowImageUrlDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  // Drag-to-select state
  const dragOverlayRef = useRef<HTMLDivElement>(null);

  // Editor instance
  const [editor, setEditor] = useState<BlockNoteEditor<any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Save Logic
  const saveTimeoutRef = useRef<number | null>(null);

  const saveToDb = useCallback(
    async (content: PartialBlock[], pageId: string) => {
      try {
        const db = await Database.load(DB_URL);
        const json = JSON.stringify(content);
        // Check if row exists, if not insert, else update?
        // Actually 'blocks' table in schema:
        // id is PRIMARY KEY. But do we mean blocks ROW id or the page's block container?
        // "blocks: id TEXT PRIMARY KEY, page_id TEXT..."
        // Usually BlockNote generates IDs for each block.
        // But we are storing the ENTIRE document content in one row?
        // Schema said: "content JSON NOT NULL".
        // If we store an array of blocks in ONE column, then the table `blocks` might be misnamed or 1:1 with pages.
        // "blocks" table: (id, page_id, content_json, sort_order).
        // It seems the plan implies multiple rows per page OR one row per page?
        // "Store block content as JSON".
        // If we store the WHOLE doc as one JSON array, the table should be `page_content` or similar.
        // If `blocks` table has `id` (primary key), it might be 1:1 with page if we key by page_id.
        // Let's assume 1:1 relationship for Phase 1 simplicity: ONE row in `blocks` table per Page containing the ARRAY of blocks.
        // OR `blocks` table has 1 row PER block. (This is harder to sync with BlockNote which gives a full array).
        // Schema said: `content JSON`. If it's one row per block, content is that block's JSON.
        // "content column ... stringified version of the BlockNote JSON structure" -> usually implies the Doc.
        // Let's assume: `blocks` table has ONE row per `page_id` containing the entire document JSON.
        // Primary Key `id` can be just `page_id` or a uuid.

        // Let's use INSERT OR REPLACE.
        // Schema: `blocks` (id, page_id, content, sort_order).
        // We'll treat `page_id` as the unique constraint or manage it.
        // Wait, schema has `id` ID. `page_id` is foreign key.
        // I will delete existing content for the page and insert new? No, that breaks history.
        // I'll ensure there is exactly one row in `blocks` for this `page_id` for now.

        // Check if exists
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
        console.log("Saved page", pageId);
      } catch (e) {
        console.error(e);
      }
    },
    [],
  );

  const debouncedSave = useCallback(
    (content: PartialBlock[], pageId: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveToDb(content, pageId);
      }, AUTOSAVE_DELAY) as unknown as number;
    },
    [saveToDb],
  );

  // Initialize Editor
  useEffect(() => {
    if (!activePageId) return;

    const loadContent = async () => {
      setIsLoading(true);
      setEditor(null); // Reset editor to force re-creation or update

      try {
        const db = await Database.load(DB_URL);
        const rows = await db.select<any[]>(
          "SELECT content FROM blocks WHERE page_id = $1",
          [activePageId],
        );

        let loaded: PartialBlock[] = [];
        if (rows.length > 0) {
          try {
            loaded = JSON.parse(rows[0].content);
          } catch (e) {
            console.error("Bad JSON", e);
          }
        }

        // Create schema with custom blocks
        // Create schema with custom blocks, extending defaults properly
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

        // Create new editor instance with custom schema
        const newEditor = BlockNoteEditor.create({
          initialContent: loaded.length > 0 ? loaded : undefined,
          schema,
        });
        setEditor(newEditor as any);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [activePageId]);

  // Handle Change
  const handleChange = () => {
    if (editor && activePageId) {
      debouncedSave(editor.document, activePageId);
    }
  };

  // Handle AI response insertion
  useEffect(() => {
    const handleInsertAI = (event: Event) => {
      const customEvent = event as CustomEvent<{ response: string }>;
      const { response } = customEvent.detail;

      if (!editor || !response) return;

      console.debug("insertAIResponse received", {
        length: response.length,
        hasEditor: !!editor,
      });

      // Parse markdown into BlockNote blocks
      const blocks = markdownToBlocks(response);
      if (blocks.length === 0) return;

      // Prefer current cursor, otherwise append to the last block
      const cursor = editor.getTextCursorPosition();
      const fallbackBlock = editor.document[editor.document.length - 1];
      const targetBlock = cursor?.block ?? fallbackBlock?.id ?? null;

      if (targetBlock) {
        editor.insertBlocks(blocks, targetBlock, "after");
      } else {
        // If no target block exists (empty doc), just add as first block
        editor.insertBlocks(blocks, editor.document[0], "before");
      }

      // Move cursor safely — avoid TextSelection error
      try {
        const lastBlock = editor.document[editor.document.length - 1];
        if (lastBlock) {
          editor.setTextCursorPosition(lastBlock, "end");
        }
      } catch {
        console.debug("Cursor positioning skipped (non-text block)");
      }

      // Animate all inserted blocks via the centralized animator
      aiAnimator.handleCommand("insert_text", blocks.length);
    };

    window.addEventListener("insertAIResponse", handleInsertAI);
    return () => window.removeEventListener("insertAIResponse", handleInsertAI);
  }, [editor]);

  // Handle Page Content Request from AgentPanel
  useEffect(() => {
    const handleGetPageContent = () => {
      if (editor) {
        try {
          const blocks = editor.document;
          let mdContent = "";

          // Convert blocks back to a markdown-like representation
          // so the AI has structural context (headings, lists, etc.)
          const blockToMd = (block: any, depth = 0): string => {
            const indent = "  ".repeat(depth);
            let text = "";

            // Extract inline text content
            const inlineText = (() => {
              if (!block.content) return "";
              if (typeof block.content === "string") return block.content;
              if (Array.isArray(block.content)) {
                return block.content
                  .map((c: any) => {
                    let t = c.text || "";
                    if (c.styles?.bold) t = `**${t}**`;
                    if (c.styles?.italic) t = `*${t}*`;
                    if (c.styles?.code) t = `\`${t}\``;
                    return t;
                  })
                  .join("");
              }
              return "";
            })();

            // Format based on block type
            switch (block.type) {
              case "heading": {
                const level = block.props?.level || 1;
                text = indent + "#".repeat(level) + " " + inlineText + "\n";
                break;
              }
              case "bulletListItem":
              case "numberedListItem":
                text = indent + "- " + inlineText + "\n";
                break;
              case "checkListItem":
                text =
                  indent +
                  (block.props?.checked ? "- [x] " : "- [ ] ") +
                  inlineText +
                  "\n";
                break;
              case "image":
                text =
                  indent +
                  `[Image: ${block.props?.caption || block.props?.url || "image"}]\n`;
                break;
              case "video":
                text = indent + "[Video block]\n";
                break;
              case "audio":
                text = indent + "[Audio block]\n";
                break;
              case "pdf":
                text = indent + "[PDF block]\n";
                break;
              case "math":
                text = indent + `$$${block.props?.latex || ""}$$\n`;
                break;
              case "mermaid":
                text =
                  indent +
                  "```mermaid\n" +
                  (block.props?.code || "") +
                  "\n```\n";
                break;
              case "chart":
                text = indent + "[Chart block]\n";
                break;
              case "kanban":
                text = indent + "[Kanban board]\n";
                break;
              default:
                // paragraph and unknown types
                if (inlineText.trim()) {
                  text = indent + inlineText + "\n";
                }
            }

            // Recurse into children
            if (block.children && block.children.length > 0) {
              block.children.forEach((child: any) => {
                text += blockToMd(child, depth + 1);
              });
            }

            return text;
          };

          blocks.forEach((block: any) => {
            const md = blockToMd(block);
            if (md.trim()) mdContent += md + "\n";
          });

          // Store in window for AgentPanel to pick up
          (window as any).__currentPageContent = mdContent.trim();
        } catch (e) {
          console.error("Failed to extract page content:", e);
        }
      }
    };

    window.addEventListener("getPageContent", handleGetPageContent);
    return () =>
      window.removeEventListener("getPageContent", handleGetPageContent);
  }, [editor]);

  // Handle AI Tool Commands
  useEffect(() => {
    const handleToolCommand = (event: Event) => {
      // Wrap in simple timeout to avoid React flushSync/lifecycle conflicts
      setTimeout(() => {
        const customEvent = event as CustomEvent<{
          action: string;
          params?: any;
        }>;
        const { action, params } = customEvent.detail;

        if (!editor) return;

        console.debug("🔧 Executing Tool:", action, params);

        // Helper to insert a custom block type
        const insertBlock = (type: string, props: any = {}) => {
          try {
            const cursor = editor.getTextCursorPosition();
            let targetBlock = cursor?.block;

            if (!targetBlock) {
              targetBlock = editor.document[editor.document.length - 1];
            }

            const currentBlockContent = (targetBlock?.content as any[]) || [];
            const isEmpty =
              currentBlockContent.length === 0 &&
              !targetBlock?.children?.length;

            if (isEmpty && targetBlock) {
              editor.updateBlock(targetBlock, { type: type as any, props });
            } else {
              editor.insertBlocks(
                [{ type: type as any, props }],
                targetBlock,
                "after",
              );
            }
          } catch (e) {
            console.warn("insertBlock fallback:", e);
            const last = editor.document[editor.document.length - 1];
            editor.insertBlocks([{ type: type as any, props }], last, "after");
          }
        };

        let insertedBlocks = 0;

        try {
          switch (action) {
            case "create_kanban":
              insertBlock("kanban");
              insertedBlocks = 1;
              break;
            case "create_mermaid":
              insertBlock("mermaid", {
                code: params?.content || "graph TD; A[Start] --> B[End];",
              });
              insertedBlocks = 1;
              break;
            case "create_chart": {
              let chartData = params?.data;
              if (typeof chartData === "object") {
                chartData = JSON.stringify(chartData);
              }
              if (!chartData) {
                chartData = JSON.stringify({
                  labels: ["A", "B", "C"],
                  datasets: [{ label: "Data", data: [10, 20, 30] }],
                });
              }
              insertBlock("chart", {
                type: params?.type || "bar",
                data: chartData,
              });
              insertedBlocks = 1;
              break;
            }
            case "create_math":
              insertBlock("math", {
                latex: params?.content || "E=mc^2",
              });
              insertedBlocks = 1;
              break;
            case "insert_image":
              if (params?.url) {
                insertBlock("image", {
                  url: params.url,
                  caption: params?.caption || "",
                });
                insertedBlocks = 1;
              }
              break;
            case "insert_text":
            case "append_text":
              if (params?.content) {
                const blocks = markdownToBlocks(params.content);
                if (blocks.length > 0) {
                  insertedBlocks = blocks.length;
                  if (action === "append_text") {
                    const lastBlock =
                      editor.document[editor.document.length - 1];
                    editor.insertBlocks(blocks, lastBlock, "after");
                  } else {
                    try {
                      const cursor = editor.getTextCursorPosition();
                      const targetBlock =
                        cursor?.block ||
                        editor.document[editor.document.length - 1];
                      editor.insertBlocks(blocks, targetBlock, "after");
                    } catch {
                      const lastBlock =
                        editor.document[editor.document.length - 1];
                      editor.insertBlocks(blocks, lastBlock, "after");
                    }
                  }
                }
              }
              break;
            case "replace_text":
              if (params?.content) {
                const blocks = markdownToBlocks(params.content);
                if (blocks.length > 0) {
                  insertedBlocks = blocks.length;
                  try {
                    const cursor = editor.getTextCursorPosition();
                    const targetBlock =
                      cursor?.block ||
                      editor.document[editor.document.length - 1];
                    editor.insertBlocks(blocks, targetBlock, "after");
                  } catch {
                    const lastBlock =
                      editor.document[editor.document.length - 1];
                    editor.insertBlocks(blocks, lastBlock, "after");
                  }
                }
              }
              break;
            case "update_page_title":
              if (params?.title && activePageId) {
                updatePageTitle(activePageId, params.title);
              }
              break;
            default:
              console.warn("Unknown tool action:", action);
          }

          // Animate via the centralized animator
          if (insertedBlocks > 0) {
            aiAnimator.handleCommand(action, insertedBlocks);
          }
        } catch (e) {
          console.error("Failed to execute tool:", e);
        }
      }, 10);
    };

    window.addEventListener("aiToolCommand", handleToolCommand);
    return () => window.removeEventListener("aiToolCommand", handleToolCommand);
  }, [editor, activePageId]);

  // Handle file upload
  const handleFileUpload = async (fileType: "image" | "video" | "pdf") => {
    if (!editor || !activePageId) return;

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
    } catch (error) {
      console.error("Failed to upload file:", error);
      alert("Failed to upload file: " + error);
    }
  };

  // Handle save as template
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

  // Handle Paste
  const handlePaste = async (event: React.ClipboardEvent) => {
    if (!editor || !activePageId) return;

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

    // If no image handled, check for HTML content (e.g. from Slides/GPT)
    if (!handledImage) {
      const html = event.clipboardData.getData("text/html");
      if (html) {
        event.preventDefault(); // Stop default plain text paste
        const markdown = htmlToMarkdown(html);
        console.debug("Parsed Paste Markdown:", markdown);

        const blocks = markdownToBlocks(markdown);
        if (blocks.length > 0) {
          editor.insertBlocks(
            blocks,
            editor.getTextCursorPosition().block,
            "after",
          );
        } else {
          // Fallback to text if conversion yields nothing useful?
          // Or maybe just let it paste as text if markdown is empty?
          // If markdown is empty but HTML existed, maybe it was just tags?
          const text = event.clipboardData.getData("text/plain");
          if (text)
            editor.insertBlocks(
              [{ type: "paragraph", content: text }],
              editor.getTextCursorPosition().block,
              "after",
            );
        }
      }
    }
  };

  // Handle Drag and Drop from Tauri
  useEffect(() => {
    if (!editor || !activePageId) return;

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
      };

      root.style.color = "#111111";
      root.style.backgroundColor = "#ffffff";
      root.classList.add("export-to-pdf");

      const styleTag = document.createElement("style");
      styleTag.setAttribute("data-export-style", "true");
      styleTag.textContent = `
        .export-to-pdf, .export-to-pdf * {
          color: #111111 !important;
        }
        .export-to-pdf pre, .export-to-pdf code {
          background: #f4f4f5 !important;
          color: #111111 !important;
        }
        .export-to-pdf table {
          color: #111111 !important;
        }
      `;

      document.head.appendChild(styleTag);

      return () => {
        root.style.color = previousStyles.color;
        root.style.backgroundColor = previousStyles.backgroundColor;
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
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff", // Ensure white background
        windowWidth: editorElement.scrollWidth,
        windowHeight: editorElement.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      // Calculate PDF dimensions (A4 reference)
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Create PDF
      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add extra pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const pages = usePageStore.getState().pages;
      const title = activePageId ? pages[activePageId]?.title : "Document";
      pdf.save(`${title}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. See console for details.");
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

  return (
    <div
      className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 px-8 py-6 relative"
      style={{ scrollBehavior: "smooth" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onPaste={handlePaste}
    >
      {/* Drag selection overlay - disabled for better UX */}
      {false && (
        <div
          ref={dragOverlayRef}
          className="fixed pointer-events-none z-40 bg-blue-500/20 border-2 border-blue-500 rounded"
          style={{
            left: "0px",
            top: "0px",
            width: "0px",
            height: "0px",
          }}
        />
      )}

      <div className="flex justify-between items-start mb-6 no-print">
        {/* Title Input */}
        <input
          className="text-4xl font-bold text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-300 border-none outline-none w-full bg-transparent"
          placeholder="Untitled"
          defaultValue={
            usePageStore.getState().pages[activePageId]?.title || ""
          }
          onChange={(e) => updatePageTitle(activePageId, e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaveTemplateDialog(true)}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-800 rounded-md text-sm hover:bg-zinc-700 transition flex items-center gap-1"
            title="Save as Template"
          >
            <FaSave size={14} />
            Save as Template
          </button>
          <div className="relative group z-50">
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-black/20">
              Export
              <FaChevronDown className="text-xs text-zinc-400 group-hover:rotate-180 transition-transform duration-300" />
            </button>

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
                  const blob = new Blob([markdown], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${usePageStore.getState().pages[activePageId]?.title || "document"}.md`;
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
                  // Quick HTML export
                  const html = await editor?.blocksToHTMLLossy(editor.document);
                  if (!html) return;

                  // Add basic styling for the HTML export
                  const fullHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <title>${usePageStore.getState().pages[activePageId]?.title || "Document"}</title>
                        <style>
                            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a1a; line-height: 1.6; }
                            pre { background: #f4f4f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
                            img { max-width: 100%; height: auto; border-radius: 8px; }
                            blockquote { border-left: 4px solid #e4e4e7; padding-left: 15px; margin-left: 0; color: #52525b; }
                        </style>
                    </head>
                    <body>
                        <h1>${usePageStore.getState().pages[activePageId]?.title || "Document"}</h1>
                        ${html}
                    </body>
                    </html>
                   `;

                  const blob = new Blob([fullHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${usePageStore.getState().pages[activePageId]?.title || "document"}.html`;
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
                  subtext: "Insert a Mermaid diagram (flowchart, sequence, ER)",
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
    </div>
  );
};
