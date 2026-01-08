import { createReactBlockSpec } from "@blocknote/react";
import mermaid from "mermaid";
import { useEffect, useMemo, useRef, useState } from "react";

export const MermaidBlock = createReactBlockSpec(
  {
    type: "mermaid",
    propSchema: {
      code: {
        default:
          "flowchart TD\n  A[Start] --> B{Decision}\n  B -- Yes --> C[Do thing]\n  B -- No --> D[Stop]",
      },
      theme: {
        default: "dark",
      },
      align: {
        default: "center",
      },
      width: {
        default: 800,
      },
      height: {
        default: 400,
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const containerRef = useRef<HTMLDivElement>(null);
      const wrapperRef = useRef<HTMLDivElement>(null);
      const [isEditing, setIsEditing] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [isResizing, setIsResizing] = useState(false);

      const code = props.block.props.code as string;
      const theme = props.block.props.theme as
        | "default"
        | "dark"
        | "neutral"
        | string;
      const width = props.block.props.width as number;
      const height = props.block.props.height as number;

      const renderedId = useMemo(
        () => `mermaid-${props.block.id}`,
        [props.block.id]
      );

      useEffect(() => {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme || "dark",
          securityLevel: "loose",
          flowchart: { useMaxWidth: true },
        });
      }, [theme]);

      useEffect(() => {
        if (isEditing) return;
        const el = containerRef.current;
        if (!el) return;
        setError(null);

        // Clear previous render
        el.innerHTML = "";

        try {
          const render = async () => {
            // Clear mermaid cache to force fresh render
            if (mermaid.mermaidAPI) {
              mermaid.mermaidAPI.reset?.();
            }

            const result = await mermaid.render(renderedId, code);
            el.innerHTML = result.svg;

            // Make SVG responsive and fill container
            const svg = el.querySelector("svg");
            if (svg) {
              svg.style.width = "100%";
              svg.style.height = "100%";
              svg.style.maxWidth = "none";
              svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
            }
          };
          render();
        } catch (e: any) {
          setError(e?.message ?? "Failed to render diagram");
        }
      }, [code, isEditing, renderedId, theme]);

      const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;

          // Calculate new width in pixels (no limit!)
          const newWidth = Math.max(300, startWidth + deltaX);

          // Calculate new height in pixels
          const newHeight = Math.max(200, startHeight + deltaY);

          props.editor.updateBlock(props.block, {
            props: {
              width: Math.round(newWidth) as any,
              height: Math.round(newHeight) as any,
            },
          });
        };

        const handleMouseUp = () => {
          setIsResizing(false);
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      };

      return (
        <div className="my-4" contentEditable={false} ref={wrapperRef}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-zinc-500">
              Mermaid Diagram - {width}px × {height}px
            </div>
            <div className="flex gap-2">
              <select
                className="text-xs bg-zinc-800 text-white rounded px-2 py-1"
                value={theme}
                onChange={(e) =>
                  props.editor.updateBlock(props.block, {
                    props: { theme: e.target.value },
                  })
                }
              >
                <option value="default">default</option>
                <option value="dark">dark</option>
                <option value="neutral">neutral</option>
              </select>
              <button
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setIsEditing((v) => !v)}
              >
                {isEditing ? "Preview" : "Edit"}
              </button>
            </div>
          </div>
          {isEditing ? (
            <textarea
              className="w-full h-56 bg-zinc-900 text-zinc-100 rounded p-2 font-mono text-sm"
              defaultValue={code}
              onChange={(e) =>
                props.editor.updateBlock(props.block, {
                  props: { code: e.target.value },
                })
              }
              onBlur={() => setIsEditing(false)}
            />
          ) : (
            <div className="relative group" style={{ width: `${width}px` }}>
              <div
                className={`overflow-auto rounded border-2 p-3 bg-zinc-950 transition-colors flex items-center justify-center ${
                  isResizing ? "border-blue-500" : "border-zinc-700"
                }`}
                style={{ height: `${height}px`, minHeight: `${height}px` }}
              >
                <div
                  ref={containerRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
                {error && (
                  <div className="text-red-500 text-sm mt-2">{error}</div>
                )}
              </div>
              {/* Resize handle - bottom right corner */}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                onMouseDown={handleResizeStart}
                style={{
                  background:
                    "linear-gradient(135deg, transparent 50%, #3b82f6 50%)",
                }}
                title="Drag to resize"
              />
              {/* Resize handle - bottom edge */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500 rounded"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsResizing(true);
                  const startY = e.clientY;
                  const startHeight = height;
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaY = moveEvent.clientY - startY;
                    const newHeight = Math.max(200, startHeight + deltaY);
                    props.editor.updateBlock(props.block, {
                      props: { height: Math.round(newHeight) as any },
                    });
                  };
                  const handleMouseUp = () => {
                    setIsResizing(false);
                    document.removeEventListener("mousemove", handleMouseMove);
                    document.removeEventListener("mouseup", handleMouseUp);
                  };
                  document.addEventListener("mousemove", handleMouseMove);
                  document.addEventListener("mouseup", handleMouseUp);
                }}
                title="Drag to resize height"
              />
              {/* Resize handle - right edge */}
              <div
                className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-16 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500 rounded"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsResizing(true);
                  const startX = e.clientX;
                  const startWidth = width;
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const newWidth = Math.max(300, startWidth + deltaX);
                    props.editor.updateBlock(props.block, {
                      props: { width: Math.round(newWidth) as any },
                    });
                  };
                  const handleMouseUp = () => {
                    setIsResizing(false);
                    document.removeEventListener("mousemove", handleMouseMove);
                    document.removeEventListener("mouseup", handleMouseUp);
                  };
                  document.addEventListener("mousemove", handleMouseMove);
                  document.addEventListener("mouseup", handleMouseUp);
                }}
                title="Drag to resize width"
              />
            </div>
          )}
        </div>
      );
    },
  }
);
