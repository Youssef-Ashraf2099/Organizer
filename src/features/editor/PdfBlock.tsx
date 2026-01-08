import { createReactBlockSpec } from "@blocknote/react";
import { useState, useRef, useEffect } from "react";
import { getAssetUrl, deleteAsset } from "../../core/services/fileService";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaExternalLinkAlt } from "@react-icons/all-files/fa/FaExternalLinkAlt";

export const PdfBlock = createReactBlockSpec(
  {
    type: "pdf",
    propSchema: {
      assetId: {
        default: "",
      },
      filePath: {
        default: "",
      },
      fileName: {
        default: "",
      },
      height: {
        default: 600, // pixels
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const [pdfUrl, setPdfUrl] = useState<string | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [showControls, setShowControls] = useState(false);
      const iframeRef = useRef<HTMLIFrameElement>(null);

      // Load PDF URL
      useEffect(() => {
        const loadPdf = async () => {
          if (props.block.props.filePath) {
            try {
              const url = await getAssetUrl(props.block.props.filePath);
              setPdfUrl(url);
            } catch (error) {
              console.error("Failed to load PDF:", error);
            } finally {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        };
        loadPdf();
      }, [props.block.props.filePath]);

      const handleDelete = async () => {
        if (props.block.props.assetId && props.block.props.filePath) {
          try {
            await deleteAsset(props.block.props.assetId, props.block.props.filePath);
            props.editor.removeBlocks([props.block]);
          } catch (error) {
            console.error("Failed to delete PDF:", error);
          }
        } else {
          props.editor.removeBlocks([props.block]);
        }
      };

      const handleResize = (newHeight: number) => {
        props.editor.updateBlock(props.block, {
          props: { height: Math.max(200, Math.min(1200, newHeight)) },
        });
      };

      const handleOpenExternal = () => {
        if (pdfUrl) {
          window.open(pdfUrl, "_blank");
        }
      };

      if (isLoading) {
        return (
          <div className="my-4 p-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
            <div className="text-zinc-500">Loading PDF...</div>
          </div>
        );
      }

      if (!pdfUrl) {
        return (
          <div className="my-4 p-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
            <div className="text-zinc-500">PDF not found</div>
          </div>
        );
      }

      return (
        <div
          className="my-4 relative group"
          contentEditable={false}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <div className="flex justify-center">
            <div className="relative w-full">
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                className="rounded-lg shadow-lg border border-zinc-300 dark:border-zinc-700 bg-white"
                style={{
                  width: "100%",
                  height: `${props.block.props.height}px`,
                }}
                title={props.block.props.fileName}
              />
              
              {showControls && (
                <div className="absolute top-2 right-2 flex gap-2 bg-zinc-900/80 rounded-md p-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenExternal();
                    }}
                    className="p-1.5 text-white hover:bg-zinc-700 rounded transition"
                    title="Open in new tab"
                  >
                    <FaExternalLinkAlt size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="p-1.5 text-white hover:bg-red-600 rounded transition"
                    title="Delete"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {showControls && (
            <div className="mt-2 flex justify-center gap-2">
              <input
                type="range"
                min="200"
                max="1200"
                value={props.block.props.height}
                onChange={(e) => handleResize(Number(e.target.value))}
                className="w-48"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-zinc-500">
                {props.block.props.height}px
              </span>
            </div>
          )}
        </div>
      );
    },
  }
);

