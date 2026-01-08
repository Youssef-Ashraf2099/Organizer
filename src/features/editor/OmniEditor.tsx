import { useEffect, useRef, useState, useCallback } from 'react';
import { BlockNoteEditor, PartialBlock, BlockNoteSchema } from "@blocknote/core";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { usePageStore } from '../../core/store/pageStore';
import Database from '@tauri-apps/plugin-sql';
import { MathBlock } from './MathBlock';
import { ImageBlock } from './ImageBlock';
import { VideoBlock } from './VideoBlock';
import { PdfBlock } from './PdfBlock';
import { FaCalculator } from "@react-icons/all-files/fa/FaCalculator";
import { FaImage } from "@react-icons/all-files/fa/FaImage";
import { FaVideo } from "@react-icons/all-files/fa/FaVideo";
import { FaFilePdf } from "@react-icons/all-files/fa/FaFilePdf";
import { FaSave } from "@react-icons/all-files/fa/FaSave";
import { uploadFileFromPicker, uploadFileFromPath } from '../../core/services/fileService';
import { useTemplateStore } from '../../core/store/templateStore';
// I will implement a custom debounce or just setTimeout. 
// Or I can install `use-debounce`. I'll do custom ref.

const AUTOSAVE_DELAY = 1000;

interface OmniEditorProps {
    onUpload?: (file: File) => Promise<string>;
    onAISuggest?: (context: string) => Promise<string>;
}

export const OmniEditor = ({ onUpload, onAISuggest }: OmniEditorProps) => {
    // Dormant hooks stub - logging to satisfy linter until implemented
    useEffect(() => {
        if (onUpload) console.debug("Upload handler registered");
        if (onAISuggest) console.debug("AI handler registered");
    }, [onUpload, onAISuggest]);

    const activePageId = usePageStore(s => s.activePageId);
    const updatePageTitle = usePageStore(s => s.updatePageTitle);
    const createTemplate = useTemplateStore(s => s.createTemplate);
    const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    
    // Editor instance
    const [editor, setEditor] = useState<BlockNoteEditor<any> | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Save Logic
    const saveTimeoutRef = useRef<number | null>(null);
    
    const saveToDb = useCallback(async (content: PartialBlock[], pageId: string) => {
        try {
            const db = await Database.load('sqlite:omni_workspace.db');
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
            const existing = await db.select<any[]>('SELECT id FROM blocks WHERE page_id = $1', [pageId]);
            if (existing.length > 0) {
                 await db.execute('UPDATE blocks SET content = $1 WHERE page_id = $2', [json, pageId]);
            } else {
                 await db.execute('INSERT INTO blocks (id, page_id, content, sort_order) VALUES ($1, $2, $3, $4)', [crypto.randomUUID(), pageId, json, 0]);
            }
            console.log('Saved page', pageId);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const debouncedSave = useCallback((content: PartialBlock[], pageId: string) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveToDb(content, pageId);
        }, AUTOSAVE_DELAY) as unknown as number;
    }, [saveToDb]);

    // Initialize Editor
    useEffect(() => {
        if(!activePageId) return;

        const loadContent = async () => {
            setIsLoading(true);
            setEditor(null); // Reset editor to force re-creation or update
            
            try {
                const db = await Database.load('sqlite:omni_workspace.db');
                const rows = await db.select<any[]>('SELECT content FROM blocks WHERE page_id = $1', [activePageId]);
                
                let loaded: PartialBlock[] = [];
                if (rows.length > 0) {
                    try {
                        loaded = JSON.parse(rows[0].content);
                    } catch(e) { console.error("Bad JSON", e); }
                }
                
                // Create schema with custom blocks
                const schema = BlockNoteSchema.create({
                    blockSpecs: {
                        ...BlockNoteSchema.create().blockSpecs,
                        math: MathBlock(),
                        image: ImageBlock(),
                        video: VideoBlock(),
                        pdf: PdfBlock(),
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

    // Handle file upload
    const handleFileUpload = async (fileType: 'image' | 'video' | 'pdf') => {
        if (!editor || !activePageId) return;

        try {
            const assetInfo = await uploadFileFromPicker(activePageId);
            if (!assetInfo) return;

            const blockType = fileType === 'image' ? 'image' : fileType === 'video' ? 'video' : 'pdf';
            const blockProps: any = {
                assetId: assetInfo.id,
                filePath: assetInfo.file_path,
                fileName: assetInfo.file_name,
            };

            if (blockType === 'image') {
                blockProps.width = 100;
                blockProps.alt = assetInfo.file_name;
            } else if (blockType === 'video') {
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
            console.error('Failed to upload file:', error);
            alert('Failed to upload file: ' + error);
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
                '📄'
            );
            setShowSaveTemplateDialog(false);
            setTemplateName('');
            setTemplateDescription('');
            alert('Template saved successfully!');
        } catch (error) {
            console.error('Failed to save template:', error);
            alert('Failed to save template: ' + error);
        }
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
        return <div className="flex-1 flex items-center justify-center text-zinc-400">Select a page</div>;
    }

    if (isLoading || !editor) {
        return <div className="p-10 text-zinc-400">Loading...</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 px-8 py-6">
             <div className="flex justify-between items-start mb-6 no-print">
                 {/* Title Input */}
                 <input 
                    className="text-4xl font-bold text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-300 border-none outline-none w-full bg-transparent"
                    placeholder="Untitled"
                    defaultValue={usePageStore.getState().pages[activePageId]?.title || ''}
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
             
             <div className="min-h-[70vh] pb-48">
                <BlockNoteView editor={editor} onChange={handleChange} theme={darkTheme} slashMenu={false}>
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
                                    title: "Image",
                                    onItemClick: () => handleFileUpload('image'),
                                    aliases: ["img", "picture", "photo"],
                                    group: "Images",
                                    icon: <FaImage />,
                                    subtext: "Upload and insert an image",
                                },
                                {
                                    title: "Video",
                                    onItemClick: () => handleFileUpload('video'),
                                    aliases: ["movie", "clip"],
                                    group: "Videos",
                                    icon: <FaVideo />,
                                    subtext: "Upload and insert a video",
                                },
                                {
                                    title: "PDF",
                                    onItemClick: () => handleFileUpload('pdf'),
                                    aliases: ["document", "file"],
                                    group: "Documents",
                                    icon: <FaFilePdf />,
                                    subtext: "Upload and embed a PDF",
                                },
                            ];
                            
                            return items.filter((item) => {
                                const lowerQuery = query.toLowerCase();
                                return (
                                    item.title.toLowerCase().includes(lowerQuery) ||
                                    (item.aliases && item.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery)))
                                );
                            });
                        }}
                    />
                </BlockNoteView>
             </div>

             {/* Save as Template Dialog */}
             {showSaveTemplateDialog && (
                 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                     <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md">
                         <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
                             Save as Template
                         </h3>
                         <div className="space-y-4">
                             <div>
                                 <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                     Template Name *
                                 </label>
                                 <input
                                     type="text"
                                     value={templateName}
                                     onChange={(e) => setTemplateName(e.target.value)}
                                     className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                     placeholder="Enter template name"
                                 />
                             </div>
                             <div>
                                 <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                     Description
                                 </label>
                                 <textarea
                                     value={templateDescription}
                                     onChange={(e) => setTemplateDescription(e.target.value)}
                                     className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                     placeholder="Enter template description"
                                     rows={3}
                                 />
                             </div>
                             <div className="flex gap-2 justify-end">
                                 <button
                                     onClick={() => {
                                         setShowSaveTemplateDialog(false);
                                         setTemplateName('');
                                         setTemplateDescription('');
                                     }}
                                     className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                                 >
                                     Cancel
                                 </button>
                                 <button
                                     onClick={handleSaveAsTemplate}
                                     disabled={!templateName.trim()}
                                     className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     Save
                                 </button>
                             </div>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};
