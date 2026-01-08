import { createReactBlockSpec } from "@blocknote/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef, useState } from "react";


export const MathBlock = createReactBlockSpec(
  {
    type: "math",
    propSchema: {
      latex: {
        default: "\\sum",
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const [isEditing, setIsEditing] = useState(false);
      const [latexError, setLatexError] = useState<string | null>(null);
      const containerRef = useRef<HTMLDivElement>(null);
      const textareaRef = useRef<HTMLTextAreaElement>(null);

      // Render LaTeX when not editing or when latex prop changes
      useEffect(() => {
        if (!isEditing && containerRef.current) {
          try {
            katex.render(props.block.props.latex || "\\sum", containerRef.current, {
              throwOnError: false, // Don't crash on invalid latex, just show error in red
              displayMode: true,
            });
            setLatexError(null);
          } catch (e: any) {
             setLatexError(e.message);
          }
        }
      }, [props.block.props.latex, isEditing]);

      // Focus textarea when entering edit mode
      useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            // Select all text mainly for convenience
            textareaRef.current.select();
        }
      }, [isEditing]);

      const handleBlur = () => {
         setIsEditing(false);
      };

      const handleContainerClick = () => {
          setIsEditing(true);
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              setIsEditing(false);
          }
           if (e.key === "Escape") {
              setIsEditing(false);
          }
      };

      return (
        <div className={"math-block-wrapper my-4 text-center select-none"}>
            {/* 
                CRITICAL: contentEditable={false} prevents Prosemirror/BlockNote 
                from trying to manage the DOM inside this div. 
                This prevents the infinite loop/conflict issues with KaTeX.
            */}
          <div 
            contentEditable={false} 
            className={`p-2 rounded-md transition-colors duration-200 border-2 ${isEditing ? 'border-blue-500 bg-zinc-900' : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900/50 cursor-pointer'}`}
            onClick={!isEditing ? handleContainerClick : undefined}
          >
            {isEditing ? (
             <div className="flex flex-col gap-2">
                 <div className="text-xs text-zinc-500 font-mono text-left">LaTeX Equation (Press Enter to save)</div>
                  <textarea
                    ref={textareaRef}
                    className="w-full bg-zinc-800 text-zinc-200 font-mono p-2 rounded text-sm focus:outline-none resize-none"
                    rows={3}
                    defaultValue={props.block.props.latex}
                    onChange={(e) => {
                        // Update block props directly
                        props.editor.updateBlock(props.block, {
                            props: { latex: e.target.value }
                        });
                    }}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    // Prevent these events from bubbling to editor to avoid conflicts while typing
                    onCut={(e) => e.stopPropagation()}
                    onCopy={(e) => e.stopPropagation()}
                    onPaste={(e) => e.stopPropagation()}
                  />
                  {/* Live Preview could go here if we wanted it alongside */}
             </div>
            ) : (
                <div ref={containerRef} className="text-2xl text-zinc-800 dark:text-zinc-200 pointer-events-none" />
            )}
             
            {latexError && !isEditing && (
                <div className="text-red-500 text-sm mt-1">{latexError}</div>
            )}
          </div>
        </div>
      );
    },
  }
);
