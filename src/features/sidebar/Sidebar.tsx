import { useEffect, useState } from "react";
import { usePageStore } from "../../core/store/pageStore";
import { useChatStore } from "../../core/store/chatStore";
import { ChevronRight, Plus, Trash2, FileText, MessageSquare } from "lucide-react";
import { cn } from "../../lib/utils";
import { TemplatePicker } from "../templates/TemplatePicker";
import { TemplateManager } from "../templates/TemplateManager";
import { Template } from "../../core/templates/builtinTemplates";
import { FolderOpen } from "lucide-react";

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
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
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
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
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

export const Sidebar = ({ view }: { view?: string }) => {
  const rootIds = usePageStore((s) => s.rootPageIds);
  const loadTree = usePageStore((s) => s.loadTree);
  const addPage = usePageStore((s) => s.addPage);
  const setActivePage = usePageStore((s) => s.setActivePage);
  
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

  const isChatMode = view === "aichat";

  return (
    <>
      <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 no-print">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">
            Omni
          </span>
          <button
            onClick={() => isChatMode ? addConversation() : handleAddPage(null)}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded"
            title={isChatMode ? "New Conversation" : "New Page"}
          >
            <Plus size={16} />
          </button>
        </div>

        {!isChatMode && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 p-2">
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-2">
              Templates
            </div>
            <button
              onClick={() => setShowTemplateManager(true)}
              className="w-full px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded flex items-center gap-2 transition"
            >
              <FolderOpen size={14} />
              Manage Templates
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          {isChatMode ? (
             <>
               <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-4">
                Conversations
              </div>
              {conversations.length === 0 && (
                <div className="px-4 text-xs text-zinc-400">No conversations yet</div>
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
               <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase px-2">
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

