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
import { MathBlock } from "./MathBlock";
import { ImageBlock } from "./ImageBlock";
import { VideoBlock } from "./VideoBlock";
import { PdfBlock } from "./PdfBlock";
import { MermaidBlock } from "./MermaidBlock";
import { ChartBlock } from "./ChartBlock";
import { KanbanBlock } from "./KanbanBlock";
import { markdownToBlocks } from "./markdownParser";
import { FaCalculator } from "@react-icons/all-files/fa/FaCalculator";
import { FaImage } from "@react-icons/all-files/fa/FaImage";
import { FaVideo } from "@react-icons/all-files/fa/FaVideo";
import { FaFilePdf } from "@react-icons/all-files/fa/FaFilePdf";
import { FaLink } from "@react-icons/all-files/fa/FaLink";
import { FaProjectDiagram } from "@react-icons/all-files/fa/FaProjectDiagram";
import { FaChartBar } from "@react-icons/all-files/fa/FaChartBar";
import { FaTasks } from "@react-icons/all-files/fa/FaTasks";
import { FaSave } from "@react-icons/all-files/fa/FaSave";
import { uploadFileFromPicker, uploadFileFromBytes, uploadFileFromPath } from "../../core/services/fileService";
import { useTemplateStore } from "../../core/store/templateStore";
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
        const db = await Database.load("sqlite:omni_workspace.db");
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
          [pageId]
        );
        if (existing.length > 0) {
          await db.execute(
            "UPDATE blocks SET content = $1 WHERE page_id = $2",
            [json, pageId]
          );
        } else {
          await db.execute(
            "INSERT INTO blocks (id, page_id, content, sort_order) VALUES ($1, $2, $3, $4)",
            [crypto.randomUUID(), pageId, json, 0]
          );
        }
        console.log("Saved page", pageId);
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

  const debouncedSave = useCallback(
    (content: PartialBlock[], pageId: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveToDb(content, pageId);
      }, AUTOSAVE_DELAY) as unknown as number;
    },
    [saveToDb]
  );

  // Initialize Editor
  useEffect(() => {
    if (!activePageId) return;

    const loadContent = async () => {
      setIsLoading(true);
      setEditor(null); // Reset editor to force re-creation or update

      try {
        const db = await Database.load("sqlite:omni_workspace.db");
        const rows = await db.select<any[]>(
          "SELECT content FROM blocks WHERE page_id = $1",
          [activePageId]
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
        const schema = BlockNoteSchema.create({
          blockSpecs: {
            ...BlockNoteSchema.create().blockSpecs,
            math: MathBlock(),
            image: ImageBlock(),
            video: VideoBlock(),
            pdf: PdfBlock(),
            mermaid: MermaidBlock(),
            chart: ChartBlock(),
            kanban: KanbanBlock(),
          },
        });

        // Create new editor instance with custom schema
        const newEditor = BlockNoteEditor.create({
          initialContent: loaded.length > 0 ? loaded : undefined,
          schema,
        });
        setEditor(newEditor);
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

      // Move cursor after inserted blocks
      const lastBlock = editor.document[editor.document.length - 1];
      if (lastBlock) {
        // Cursor positioning - optional, not critical for animation
        try {
          editor.setTextCursorPosition(lastBlock, "start");
        } catch (e) {
          // Cursor positioning failed, but animation still works
          console.debug("Cursor positioning skipped");
        }
      }

      // Apply typing animation to newly inserted blocks
      setTimeout(() => {
        const blockContainer = document.querySelector(
          '[class*="BlockNoteView"]'
        ) as HTMLElement;
        if (!blockContainer) return;

        // Get all block elements and apply animation to the last N blocks
        const blockElements = Array.from(
          blockContainer.querySelectorAll("[data-node-type]")
        ).slice(-blocks.length) as HTMLElement[];

        blockElements.forEach((element, index) => {
          element.style.opacity = "0";
          element.style.transform = "translateY(8px) scale(0.95)";
          element.style.filter = "blur(4px)";
          element.style.animation = `aiTypeIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${
            index * 0.1
          }s both`;
        });
      }, 0);
    };

    window.addEventListener("insertAIResponse", handleInsertAI);
    return () => window.removeEventListener("insertAIResponse", handleInsertAI);
  }, [editor]);

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
        "after"
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
        "📄"
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

    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;

        try {
          const bytes = await file.arrayBuffer();
          const extension = file.name.split(".").pop() || "png";
          const assetInfo = await uploadFileFromBytes(
            bytes,
            file.name,
            extension,
            activePageId
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
            "after"
          );
        } catch (error) {
          console.error("Paste upload failed:", error);
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
            extension
          );
          const isVideo = ["mp4", "webm", "mov"].includes(extension);
          const isPdf = extension === "pdf";

          if (isImage || isVideo || isPdf) {
            try {
              const assetInfo = await uploadFileFromPath(filePath, activePageId);
              
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
                "after"
              );
            } catch (e) {
              console.error("Drag-drop upload failed:", e);
            }
          }
        }
      }
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
        "after"
      );
      setShowImageUrlDialog(false);
      setImageUrl("");
    }
  };

  // Drag-to-select handlers - disabled to avoid interference with normal editor interactions
  // Users can still use native text selection (click and drag) or Ctrl+A
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
      sideMenu: "#a1a1aa", // Color of the drag handle icon itself
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
          <button
            onClick={() => window.print()}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-800 rounded-md text-sm hover:bg-zinc-700 transition"
            title="Export to PDF"
          >
            Export PDF
          </button>
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
                      "after"
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
                      "after"
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
                      "after"
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
                      "after"
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
              ];

              return items.filter((item: any) => {
                const lowerQuery = query.toLowerCase();
                return (
                  item.title?.toLowerCase().includes(lowerQuery) ||
                  (item.aliases &&
                    item.aliases.some((alias: string) =>
                      alias.toLowerCase().includes(lowerQuery)
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
