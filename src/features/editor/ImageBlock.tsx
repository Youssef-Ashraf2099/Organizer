import { createReactBlockSpec } from "@blocknote/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { getAssetUrl, deleteAsset } from "../../core/services/fileService";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaExpand } from "@react-icons/all-files/fa/FaExpand";
import { FaCompress } from "@react-icons/all-files/fa/FaCompress";
import { FaCrop } from "@react-icons/all-files/fa/FaCrop";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop/types";
import "react-easy-crop/react-easy-crop.css";

export const ImageBlock = createReactBlockSpec(
  {
    type: "image",
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
      alt: {
        default: "",
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const [imageUrl, setImageUrl] = useState<string | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [isExpanded, setIsExpanded] = useState(false);
      const [showControls, setShowControls] = useState(false);
      const [showCrop, setShowCrop] = useState(false);
      const [crop, setCrop] = useState({ x: 0, y: 0 });
      const [zoom, setZoom] = useState(1);
      const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
      const imageRef = useRef<HTMLImageElement>(null);

      // Load image URL
      useEffect(() => {
        const loadImage = async () => {
          if (props.block.props.filePath) {
            try {
              const url = await getAssetUrl(props.block.props.filePath);
              setImageUrl(url);
            } catch (error) {
              console.error("Failed to load image:", error);
            } finally {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        };
        loadImage();
      }, [props.block.props.filePath]);

      const handleDelete = async () => {
        if (props.block.props.assetId && props.block.props.filePath) {
          try {
            await deleteAsset(props.block.props.assetId, props.block.props.filePath);
            props.editor.removeBlocks([props.block]);
          } catch (error) {
            console.error("Failed to delete image:", error);
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

      const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
      }, []);

      const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.addEventListener("load", () => resolve(image));
          image.addEventListener("error", (error) => reject(error));
          image.src = url;
        });

      const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("No 2d context");
        }

        const maxSize = Math.max(image.width, image.height);
        const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );

        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              resolve(blobUrl);
            }
          }, "image/jpeg");
        });
      };

      const handleCrop = async () => {
        if (!imageUrl || !croppedAreaPixels) return;

        try {
          const croppedImageUrl = await getCroppedImg(imageUrl, croppedAreaPixels);
          setImageUrl(croppedImageUrl);
          setShowCrop(false);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setCroppedAreaPixels(null);
        } catch (error) {
          console.error("Failed to crop image:", error);
          alert("Failed to crop image");
        }
      };

      if (isLoading) {
        return (
          <div className="my-4 p-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
            <div className="text-zinc-500">Loading image...</div>
          </div>
        );
      }

      if (!imageUrl) {
        return (
          <div className="my-4 p-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
            <div className="text-zinc-500">Image not found</div>
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
              <img
                ref={imageRef}
                src={imageUrl}
                alt={props.block.props.alt || props.block.props.fileName}
                className={`rounded-lg shadow-lg transition-all duration-200 ${
                  isExpanded ? "cursor-zoom-out" : "cursor-zoom-in"
                }`}
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                }}
              />
              
              {showControls && (
                <div className="absolute top-2 right-2 flex gap-2 bg-zinc-900/80 rounded-md p-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCrop(true);
                    }}
                    className="p-1.5 text-white hover:bg-zinc-700 rounded transition"
                    title="Crop"
                  >
                    <FaCrop size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    className="p-1.5 text-white hover:bg-zinc-700 rounded transition"
                    title={isExpanded ? "Shrink" : "Expand"}
                  >
                    {isExpanded ? (
                      <FaCompress size={14} />
                    ) : (
                      <FaExpand size={14} />
                    )}
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
          
          {isExpanded && (
            <div
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => setIsExpanded(false)}
            >
              <img
                src={imageUrl}
                alt={props.block.props.alt || props.block.props.fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {showCrop && imageUrl && (
            <div
              className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
              contentEditable={false}
            >
              <div className="w-full max-w-4xl h-[80vh] relative bg-zinc-900 rounded-lg overflow-hidden">
                <Cropper
                  image={imageUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={undefined}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  style={{
                    containerStyle: {
                      width: "100%",
                      height: "100%",
                      position: "relative",
                    },
                  }}
                />
              </div>
              <div className="mt-4 flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-white text-sm">Zoom:</label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-white text-sm">{zoom.toFixed(1)}x</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCrop(false);
                      setCrop({ x: 0, y: 0 });
                      setZoom(1);
                      setCroppedAreaPixels(null);
                    }}
                    className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCrop}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
  }
);

