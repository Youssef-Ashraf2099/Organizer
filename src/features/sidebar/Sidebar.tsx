import { useEffect, useState } from "react";
import { usePageStore } from "../../core/store/pageStore";
import { useChatStore } from "../../core/store/chatStore";
import {
  ChevronRight,
  FolderOpen,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  Layers3,
  FolderPlus,
  Pencil,
  FileImage,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { TemplatePicker } from "../templates/TemplatePicker";
import { TemplateManager } from "../templates/TemplateManager";
import { Template } from "../../core/templates/builtinTemplates";
import { useDiagramStore } from "../../core/store/diagramStore";
import type {
  DiagramFolder,
  DiagramRecord,
} from "../../core/services/diagramService";

const PageItem = ({
  pageId,
  level,
  onAddChild,
}: {
  pageId: string;
  level: number;
  onAddChild: (parentId: string) => void;
}) => {
  const page = usePageStore((s) => s.pages[pageId]);
  const children = usePageStore((s) => s.childrenMap[pageId]);
  const activePageId = usePageStore((s) => s.activePageId);
  const setActivePage = usePageStore((s) => s.setActivePage);
  const deletePage = usePageStore((s) => s.deletePage);

  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = children && children.length > 0;

  const handleSelect = () => {
    setActivePage(pageId);
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddChild(pageId);
    setIsOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this page?")) {
      await deletePage(pageId);
    }
  };

  if (!page) return null;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm mb-0.5 group transition-colors",
          pageId === activePageId
            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleSelect}
      >
        <div
          className="p-0.5 rounded-sm hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
          onClick={hasChildren ? handleExpand : undefined}
        >
          {hasChildren ? (
            <ChevronRight
              size={14}
              className={cn("transition-transform", isOpen && "rotate-90")}
            />
          ) : (
            <div className="w-[14px]" />
          )}
        </div>

        <FileText size={16} className="opacity-70" />

        <span className="truncate flex-1 select-none">
          {page.title || "Untitled"}
        </span>

        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={handleAddChild}
            className="p-1 hover:bg-zinc-300 rounded"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 hover:bg-zinc-300 rounded text-red-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {isOpen &&
        hasChildren &&
        children.map((childId) => (
          <PageItem
            key={childId}
            pageId={childId}
            level={level + 1}
            onAddChild={onAddChild}
          />
        ))}
    </div>
  );
};

const ConversationItem = ({
  title,
  isActive,
  onSelect,
  onDelete,
}: {
  id: string;
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm mb-0.5 group transition-colors mx-2",
        isActive
          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50",
      )}
    >
      <MessageSquare size={16} className="opacity-70" />
      <span className="truncate flex-1 select-none">{title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded text-red-500 transition-opacity"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

const DiagramItem = ({
  diagram,
  isActive,
  onSelect,
  onDelete,
}: {
  diagram: DiagramRecord;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm mb-0.5 group transition-colors mx-2",
        isActive
          ? "bg-blue-500/15 text-blue-200 font-medium"
          : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50",
      )}
    >
      <FileImage size={14} className="opacity-70 shrink-0" />
      <span className="truncate flex-1 select-none">{diagram.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded text-red-500 transition-opacity"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

const DiagramFolderItem = ({
  folder,
  isActive,
  activeDiagramId,
  onSelectFolder,
  onSelectDiagram,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDiagram,
}: {
  folder: DiagramFolder;
  isActive: boolean;
  activeDiagramId: string | null;
  onSelectFolder: (folderId: string) => void;
  onSelectDiagram: (diagramId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteDiagram: (diagramId: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(isActive);

  return (
    <div className="mb-1">
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm group transition-colors mx-1",
          isActive
            ? "bg-blue-500/15 text-blue-200 font-medium"
            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/50",
        )}
        onClick={() => {
          onSelectFolder(folder.id);
          setIsOpen((value) => !value);
        }}
      >
        <div className="p-0.5 rounded-sm hover:bg-zinc-300 dark:hover:bg-zinc-700 transition">
          <ChevronRight
            size={14}
            className={cn("transition-transform", isOpen && "rotate-90")}
          />
        </div>
        <FolderOpen size={16} className="opacity-80 shrink-0" />
        <span className="truncate flex-1 select-none">{folder.name}</span>
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextName = window.prompt("Rename folder", folder.name);
              if (nextName?.trim()) {
                onRenameFolder(folder.id, nextName.trim());
              }
            }}
            className="p-1 hover:bg-zinc-300 rounded"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete this folder and all its diagrams?")) {
                onDeleteFolder(folder.id);
              }
            }}
            className="p-1 hover:bg-zinc-300 rounded text-red-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-1">
          {folder.diagrams.length === 0 ? (
            <div className="px-8 py-2 text-xs text-zinc-500 dark:text-zinc-500">
              No diagrams in this folder
            </div>
          ) : (
            folder.diagrams.map((diagram) => (
              <DiagramItem
                key={diagram.id}
                diagram={diagram}
                isActive={diagram.id === activeDiagramId}
                onSelect={() => onSelectDiagram(diagram.id)}
                onDelete={() => onDeleteDiagram(diagram.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const Sidebar = ({ view }: { view?: string }) => {
  const rootIds = usePageStore((s) => s.rootPageIds);
  const loadTree = usePageStore((s) => s.loadTree);
  const addPage = usePageStore((s) => s.addPage);
  const setActivePage = usePageStore((s) => s.setActivePage);

  const diagramFolders = useDiagramStore((s) => s.folders);
  const diagramActiveFolderId = useDiagramStore((s) => s.activeFolderId);
  const diagramActiveDiagramId = useDiagramStore((s) => s.activeDiagramId);
  const loadDiagramLibrary = useDiagramStore((s) => s.loadLibrary);
  const setActiveFolder = useDiagramStore((s) => s.setActiveFolder);
  const setActiveDiagram = useDiagramStore((s) => s.setActiveDiagram);
  const createDiagramFolder = useDiagramStore((s) => s.createFolder);
  const renameDiagramFolder = useDiagramStore((s) => s.renameFolder);
  const removeDiagramFolder = useDiagramStore((s) => s.removeFolder);
  const removeDiagram = useDiagramStore((s) => s.removeDiagram);
  const createDiagram = useDiagramStore((s) => s.createDiagram);

  const conversations = useChatStore((s) => s.conversations);
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const setActiveConv = useChatStore((s) => s.setActiveConversation);
  const addConversation = useChatStore((s) => s.addConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (view === "diagrams") {
      loadDiagramLibrary();
    }
  }, [view, loadDiagramLibrary]);

  const handleAddPage = (parentId: string | null = null) => {
    setPendingParentId(parentId);
    setShowTemplatePicker(true);
  };

  const handleTemplateSelect = async (template: Template | null) => {
    const templateId = template ? template.id : null;
    const newPageId = await addPage(pendingParentId, templateId);
    if (newPageId) {
      setActivePage(newPageId);
    }
    setShowTemplatePicker(false);
    setPendingParentId(null);
  };

  const isDiagramMode = view === "diagrams";

  const handleCreateDiagramFolder = async () => {
    const name = window.prompt("Folder name", "New Folder");
    if (!name?.trim()) return;
    await createDiagramFolder(name.trim());
  };

  const handleCreateDiagram = async () => {
    const targetFolderId =
      diagramActiveFolderId ?? diagramFolders[0]?.id ?? null;
    if (!targetFolderId) {
      await createDiagramFolder("New Folder");
      return;
    }

    await createDiagram({
      folderId: targetFolderId,
      name: "Untitled Diagram",
      sourceType: "mermaid",
      templateKey: "flowchart",
      code: "flowchart TD\n  A[Start] --> B[New Diagram]",
      svgMarkup: null,
      themePreset: "hc-dark",
    });
  };

  const isChatMode = view === "aichat";

  return (
    <>
      <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 no-print">
        <div className="px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-b from-white/70 to-transparent dark:from-zinc-950/70">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-100">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.65)]" />
            Omni
          </span>
          {isDiagramMode ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCreateDiagramFolder}
                className="p-2 hover:bg-zinc-200/80 dark:hover:bg-zinc-900 rounded-xl transition"
                title="New Folder"
              >
                <FolderPlus size={16} />
              </button>
              <button
                onClick={handleCreateDiagram}
                className="p-2 hover:bg-zinc-200/80 dark:hover:bg-zinc-900 rounded-xl transition"
                title="New Diagram"
              >
                <Layers3 size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                isChatMode ? addConversation() : handleAddPage(null)
              }
              className="p-2 hover:bg-zinc-200/80 dark:hover:bg-zinc-900 rounded-xl transition"
              title={isChatMode ? "New Conversation" : "New Page"}
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {isDiagramMode ? (
          <div className="border-b border-zinc-200/80 dark:border-zinc-800 p-3">
            <div className="text-[11px] font-semibold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-2">
              Diagram Library
            </div>
            <button
              onClick={handleCreateDiagramFolder}
              className="w-full px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl flex items-center gap-2 transition"
            >
              <FolderPlus size={14} />
              New Folder
            </button>
            <button
              onClick={handleCreateDiagram}
              className="w-full mt-1 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl flex items-center gap-2 transition"
            >
              <Layers3 size={14} />
              New Diagram
            </button>
          </div>
        ) : (
          !isChatMode && (
            <div className="border-b border-zinc-200/80 dark:border-zinc-800 p-3">
              <div className="text-[11px] font-semibold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-2">
                Templates
              </div>
              <button
                onClick={() => setShowTemplateManager(true)}
                className="w-full px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl flex items-center gap-2 transition"
              >
                <FolderOpen size={14} />
                Manage Templates
              </button>
            </div>
          )
        )}

        <div className="flex-1 overflow-y-auto py-2">
          {isDiagramMode ? (
            <>
              <div className="text-[11px] font-semibold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-4">
                Folders
              </div>
              {diagramFolders.length === 0 && (
                <div className="px-4 text-xs text-zinc-400">
                  No diagram folders yet
                </div>
              )}
              {diagramFolders.map((folder) => (
                <DiagramFolderItem
                  key={folder.id}
                  folder={folder}
                  isActive={folder.id === diagramActiveFolderId}
                  activeDiagramId={diagramActiveDiagramId}
                  onSelectFolder={setActiveFolder}
                  onSelectDiagram={setActiveDiagram}
                  onRenameFolder={renameDiagramFolder}
                  onDeleteFolder={removeDiagramFolder}
                  onDeleteDiagram={removeDiagram}
                />
              ))}
            </>
          ) : isChatMode ? (
            <>
              <div className="text-[11px] font-semibold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-4">
                Conversations
              </div>
              {conversations.length === 0 && (
                <div className="px-4 text-xs text-zinc-400">
                  No conversations yet
                </div>
              )}
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  id={conv.id}
                  title={conv.title}
                  isActive={conv.id === activeConvId}
                  onSelect={() => setActiveConv(conv.id)}
                  onDelete={() => deleteConversation(conv.id)}
                />
              ))}
            </>
          ) : (
            <>
              <div className="text-[11px] font-semibold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-2">
                Pages
              </div>
              {rootIds.map((id) => (
                <PageItem
                  key={id}
                  pageId={id}
                  level={0}
                  onAddChild={handleAddPage}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => {
          setShowTemplatePicker(false);
          setPendingParentId(null);
        }}
        onSelect={handleTemplateSelect}
      />

      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
      />
    </>
  );
};
