import { useState, useRef, useCallback, useEffect } from 'react';
import { Sidebar } from '../../features/sidebar/Sidebar';
import { OmniEditor } from '../../features/editor/OmniEditor';
import { cn } from '../../lib/utils';

export const AppLayout = () => {
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const isDragging = useRef(false);

  const startResizing = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isDragging.current) {
      setSidebarWidth(() => {
        const newWidth = mouseMoveEvent.clientX;
        if (newWidth < 150) return 150;
        if (newWidth > 600) return 600;
        return newWidth;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div className="h-screen w-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex overflow-hidden">
        {/* Sidebar */}
        <div 
            style={{ width: sidebarWidth }} 
            className="flex-shrink-0 flex flex-col h-full overflow-hidden"
        >
            <Sidebar />
        </div>

        {/* Resizer Handle */}
        <div 
            onMouseDown={startResizing}
            className={cn(
                "w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-50",
                isDragging.current ? "bg-blue-500" : "bg-zinc-200 dark:bg-zinc-800"
            )}
        />

        {/* Main Content */}
        <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden">
            <OmniEditor />
        </div>
    </div>
  );
};
