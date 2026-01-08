import { createReactBlockSpec } from "@blocknote/react";
import { useState, useRef, useEffect } from "react";
import { getAssetUrl, deleteAsset } from "../../core/services/fileService";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaPlay } from "@react-icons/all-files/fa/FaPlay";
import { FaPause } from "@react-icons/all-files/fa/FaPause";

export const VideoBlock = createReactBlockSpec(
  {
    type: "video",
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
      width: {
        default: 100, // percentage
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const [videoUrl, setVideoUrl] = useState<string | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [showControls, setShowControls] = useState(false);
      const videoRef = useRef<HTMLVideoElement>(null);
      const [isPlaying, setIsPlaying] = useState(false);

      // Load video URL
      useEffect(() => {
        const loadVideo = async () => {
          if (props.block.props.filePath) {
            try {
              const url = await getAssetUrl(props.block.props.filePath);
              setVideoUrl(url);
            } catch (error) {
              console.error("Failed to load video:", error);
            } finally {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        };
        loadVideo();
      }, [props.block.props.filePath]);

      const handleDelete = async () => {
        if (props.block.props.assetId && props.block.props.filePath) {
          try {
            await deleteAsset(props.block.props.assetId, props.block.props.filePath);
            props.editor.removeBlocks([props.block]);
          } catch (error) {
            console.error("Failed to delete video:", error);
          }
        } else {
          props.editor.removeBlocks([props.block]);
        }
      };

      const handleResize = (newWidth: number) => {
        props.editor.updateBlock(props.block, {
          props: { width: Math.max(10, Math.min(100, newWidth)) },
        });
      };

      const handlePlayPause = () => {
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
          } else {
            videoRef.current.play();
          }
          setIsPlaying(!isPlaying);
        }
      };

      if (isLoading) {
        return (
          <div className="my-4 p-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
            <div className="text-zinc-500">Loading video...</div>
          </div>
        );
      }

      if (!videoUrl) {
        return (
          <div className="my-4 p-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
            <div className="text-zinc-500">Video not found</div>
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
            <div
              style={{ width: `${props.block.props.width}%` }}
              className="relative"
            >
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="rounded-lg shadow-lg w-full"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              {showControls && (
                <div className="absolute top-2 right-2 flex gap-2 bg-zinc-900/80 rounded-md p-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPause();
                    }}
                    className="p-1.5 text-white hover:bg-zinc-700 rounded transition"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} />}
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
                min="10"
                max="100"
                value={props.block.props.width}
                onChange={(e) => handleResize(Number(e.target.value))}
                className="w-48"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-zinc-500">
                {props.block.props.width}%
              </span>
            </div>
          )}
        </div>
      );
    },
  }
);

