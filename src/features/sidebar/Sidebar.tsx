import { useEffect, useState } from 'react';
import { usePageStore } from '../../core/store/pageStore';
import { ChevronRight, Plus, Trash2, FileText } from 'lucide-react';
import { cn } from '../../lib/utils'; // Assuming Shadcn utils exist, if not I'll inline or create util
// I need simple utility for classnames
// I'll assume standard shadcn utils structure or minimal inline

const PageItem = ({ pageId, level }: { pageId: string; level: number }) => {
  const page = usePageStore((s) => s.pages[pageId]);
  const children = usePageStore((s) => s.childrenMap[pageId]);
  const activePageId = usePageStore((s) => s.activePageId);
  const setActivePage = usePageStore((s) => s.setActivePage);
  const addPage = usePageStore((s) => s.addPage);
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

  const handleAddChild = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await addPage(pageId);
    setIsOpen(true);
  };
  
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('Delete this page?')) {
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
                    <ChevronRight size={14} className={cn("transition-transform", isOpen && "rotate-90")} />
                ) : <div className="w-[14px]" />} 
            </div>
            
            <FileText size={16} className="opacity-70" />
            
            <span className="truncate flex-1 select-none">{page.title || "Untitled"}</span>

        <div className="hidden group-hover:flex items-center gap-1">
            <button onClick={handleAddChild} className="p-1 hover:bg-zinc-300 rounded"><Plus size={12} /></button>
            <button onClick={handleDelete} className="p-1 hover:bg-zinc-300 rounded text-red-500"><Trash2 size={12} /></button>
        </div>
      </div>
      
      {isOpen && hasChildren && children.map((childId) => (
        <PageItem key={childId} pageId={childId} level={level + 1} />
      ))}
    </div>
  );
};

export const Sidebar = () => {
  const rootIds = usePageStore((s) => s.rootPageIds);
  const loadTree = usePageStore((s) => s.loadTree);
  const addPage = usePageStore((s) => s.addPage);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 no-print">
      <div className="p-3 border-b border-zinc-200 flex items-center justify-between">
         <span className="font-semibold text-zinc-700 dark:text-zinc-200">Omni</span>
         <button onClick={() => addPage(null)} className="p-1 hover:bg-zinc-200 rounded"><Plus size={16}/></button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {rootIds.map((id) => (
          <PageItem key={id} pageId={id} level={0} />
        ))}
      </div>
      
      {/* Knowledge Base Placeholder */}
      <div className="border-t border-zinc-200 p-2">
         <div className="text-xs font-bold text-zinc-500 mb-2 uppercase px-2">Knowledge Base</div>
         <div className="px-2 py-1 text-sm text-zinc-400 italic">Documents (Coming Soon)</div>
      </div>
    </div>
  );
};

// Minimal util to avoid import errors since I haven't created lib/utils yet.
// Actually I'll rely on the user having shadcn installed which usually puts it in lib/utils.
// But wait, I installed dependencies but didn't run the shadcn init command to generate the utils file.
// I will create lib/utils.ts after this.
