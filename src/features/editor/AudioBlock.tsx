import { createReactBlockSpec } from "@blocknote/react";
import { useState, useRef, useEffect } from "react";
import { getAssetUrl, deleteAsset } from "../../core/services/fileService";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaPlay } from "@react-icons/all-files/fa/FaPlay";
import { FaPause } from "@react-icons/all-files/fa/FaPause";
import { FaMicrophone } from "@react-icons/all-files/fa/FaMicrophone";
import { FaStop } from "@react-icons/all-files/fa/FaStop";
import { FaDownload } from "@react-icons/all-files/fa/FaDownload";

export const AudioBlock = createReactBlockSpec(
  {
    type: "audio",
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
      duration: {
        default: 0,
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const [audioUrl, setAudioUrl] = useState<string | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [isPlaying, setIsPlaying] = useState(false);
      const [currentTime, setCurrentTime] = useState(0);
      const [duration, setDuration] = useState(0);
      const [isRecording, setIsRecording] = useState(false);
      const [recordingTime, setRecordingTime] = useState(0);
      const DEVICE_STORAGE_KEY = "audioPreferredInputDeviceId";
      const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
      const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
      const [volumeLevel, setVolumeLevel] = useState(0);
      const audioRef = useRef<HTMLAudioElement>(null);
      const mediaRecorderRef = useRef<MediaRecorder | null>(null);
      const chunksRef = useRef<Blob[]>([]);
      const recordingTimerRef = useRef<number | null>(null);
      const audioContextRef = useRef<AudioContext | null>(null);
      const analyserRef = useRef<AnalyserNode | null>(null);
      const animationFrameRef = useRef<number | null>(null);

      // Load available audio devices
      useEffect(() => {
        const loadDevices = async () => {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(
              (device) => device.kind === "audioinput",
            );
            setAudioDevices(audioInputs);

            // Prefer previously chosen device when available
            const saved = localStorage.getItem(DEVICE_STORAGE_KEY);
            const savedExists = audioInputs.some((d) => d.deviceId === saved);
            if (saved && savedExists) {
              setSelectedDeviceId(saved);
            } else if (audioInputs.length > 0 && !selectedDeviceId) {
              setSelectedDeviceId(audioInputs[0].deviceId);
            }
          } catch (error) {
            console.error("Failed to enumerate devices:", error);
          }
        };
        loadDevices();
      }, []);

      const setPreferredDevice = (deviceId: string) => {
        setSelectedDeviceId(deviceId);
        localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
      };

      // Load audio URL
      useEffect(() => {
        const loadAudio = async () => {
          if (props.block.props.filePath) {
            try {
              const url = await getAssetUrl(props.block.props.filePath);
              setAudioUrl(url);
            } catch (error) {
              console.error("Failed to load audio:", error);
            } finally {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        };
        loadAudio();
      }, [props.block.props.filePath]);

      // Update time
      useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);

        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("loadedmetadata", updateDuration);
        audio.addEventListener("ended", () => setIsPlaying(false));

        return () => {
          audio.removeEventListener("timeupdate", updateTime);
          audio.removeEventListener("loadedmetadata", updateDuration);
          audio.removeEventListener("ended", () => setIsPlaying(false));
        };
      }, [audioUrl]);

      const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
          audio.pause();
        } else {
          audio.play();
        }
        setIsPlaying(!isPlaying);
      };

      const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const newTime = parseFloat(e.target.value);
        audio.currentTime = newTime;
        setCurrentTime(newTime);
      };

      const handleDelete = async () => {
        if (props.block.props.assetId && props.block.props.filePath) {
          try {
            await deleteAsset(
              props.block.props.assetId,
              props.block.props.filePath,
            );
            props.editor.removeBlocks([props.block]);
          } catch (error) {
            console.error("Failed to delete audio:", error);
          }
        } else {
          props.editor.removeBlocks([props.block]);
        }
      };

      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      };

      // Recording functions
      const startRecording = async () => {
        try {
          const constraints = {
            audio: selectedDeviceId
              ? { deviceId: { exact: selectedDeviceId } }
              : true,
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);

          // Set up audio analysis for volume meter
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyserRef.current = analyser;
          analyser.fftSize = 256;
          source.connect(analyser);

          // Start volume monitoring
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              const average =
                dataArray.reduce((a, b) => a + b) / dataArray.length;
              setVolumeLevel(average / 255); // Normalize to 0-1
              animationFrameRef.current = requestAnimationFrame(updateVolume);
            }
          };
          updateVolume();

          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          chunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };

          mediaRecorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            console.log("Recording blob size:", blob.size, "bytes");
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setIsLoading(false);

            // Upload to assets folder
            try {
              const { uploadFileFromBytes } =
                await import("../../core/services/fileService");
              const arrayBuffer = await blob.arrayBuffer();
              const fileName = `recording_${Date.now()}.webm`;
              const result = await uploadFileFromBytes(
                arrayBuffer,
                fileName,
                "webm",
              );

              props.editor.updateBlock(props.block, {
                props: {
                  assetId: result.id,
                  filePath: result.file_path,
                  fileName: result.file_name,
                },
              });
            } catch (error) {
              console.error("Failed to save recording:", error);
            }

            stream.getTracks().forEach((track) => track.stop());

            // Clean up audio analysis
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
              audioContextRef.current.close();
            }
            setVolumeLevel(0);
          };

          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(0);

          recordingTimerRef.current = window.setInterval(() => {
            setRecordingTime((prev) => prev + 1);
          }, 1000);
        } catch (error) {
          console.error("Failed to start recording:", error);
          alert("Microphone access denied or not available.");
        }
      };

      const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
        }
      };

      const downloadAudio = () => {
        if (!audioUrl) return;
        const a = document.createElement("a");
        a.href = audioUrl;
        a.download = props.block.props.fileName || "recording.webm";
        a.click();
      };

      // If no audio and not recording, show upload/record options
      if (!audioUrl && !isRecording) {
        return (
          <div
            className="bg-zinc-900 rounded-lg p-6 border-2 border-dashed border-zinc-700 hover:border-zinc-600 transition"
            contentEditable={false}
          >
            <div className="flex flex-col items-center gap-4">
              <FaMicrophone size={48} className="text-zinc-600" />
              <p className="text-zinc-400 text-sm">No audio file</p>

              {/* Device selector */}
              {audioDevices.length > 1 && (
                <div className="w-full max-w-md">
                  <label className="block text-zinc-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <FaMicrophone size={14} className="text-blue-400" />
                    Select Microphone:
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setPreferredDevice(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border-2 border-zinc-700 hover:border-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition cursor-pointer shadow-sm"
                  >
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={startRecording}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                  <FaMicrophone size={16} />
                  Start Recording
                </button>
                <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition cursor-pointer">
                  Upload Audio
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      try {
                        const { uploadFileFromBytes } =
                          await import("../../core/services/fileService");
                        const arrayBuffer = await file.arrayBuffer();
                        const extension = file.name.split(".").pop() || "webm";
                        const result = await uploadFileFromBytes(
                          arrayBuffer,
                          file.name,
                          extension,
                        );

                        props.editor.updateBlock(props.block, {
                          props: {
                            assetId: result.id,
                            filePath: result.file_path,
                            fileName: result.file_name,
                          },
                        });

                        const url = await getAssetUrl(result.file_path);
                        setAudioUrl(url);
                        setIsLoading(false);
                      } catch (error) {
                        console.error("Failed to upload audio:", error);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        );
      }

      // Recording in progress
      if (isRecording) {
        return (
          <div
            className="bg-gradient-to-br from-red-950/60 via-red-900/40 to-zinc-900/90 border border-red-500/60 rounded-2xl p-6 shadow-xl shadow-red-900/25 ring-1 ring-red-500/30 backdrop-blur-sm"
            contentEditable={false}
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-5 h-5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/60" />
                    <div className="absolute inset-0 w-5 h-5 bg-red-500 rounded-full animate-ping opacity-60" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-red-100 font-bold text-lg tracking-tight">
                      Recording
                    </span>
                    <span className="text-red-200/80 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded px-2 py-1 w-max">
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={stopRecording}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                >
                  <FaStop size={16} />
                  Stop Recording
                </button>
              </div>

              {/* Volume meter */}
              <div className="w-full bg-zinc-900/60 rounded-xl p-4 border border-zinc-800/60 shadow-inner">
                <div className="flex items-center gap-4">
                  <span className="text-zinc-200 text-sm font-semibold whitespace-nowrap">
                    Input Level
                  </span>
                  <div className="relative flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden shadow-inner border border-zinc-700/60">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 transition-all duration-75 shadow-[0_0_12px_rgba(34,197,94,0.35)]"
                      style={{ width: `${Math.min(volumeLevel * 100, 100)}%` }}
                    />
                    <div className="absolute inset-0 pointer-events-none bg-white/5 mix-blend-soft-light" />
                  </div>
                  <span className="text-white text-sm font-bold w-14 text-right bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-700/50 shadow-sm">
                    {Math.round(volumeLevel * 100)}%
                  </span>
                </div>
                {volumeLevel === 0 && (
                  <div className="flex items-center gap-2 mt-3 text-yellow-300 text-xs bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-3 py-2">
                    <span className="text-lg">⚠️</span>
                    <span>
                      No audio detected. Check your microphone or try selecting
                      a different device.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      // Audio player
      return (
        <div
          className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-xl p-5 border-2 border-zinc-800 hover:border-zinc-700 transition-all shadow-lg hover:shadow-xl group"
          contentEditable={false}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-10 h-10 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <audio ref={audioRef} src={audioUrl || ""} preload="metadata" />

              <div className="flex items-center gap-5">
                <button
                  onClick={togglePlay}
                  className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-blue-500/50 hover:scale-110 flex-shrink-0"
                >
                  {isPlaying ? (
                    <FaPause size={20} className="text-white" />
                  ) : (
                    <FaPlay size={20} className="ml-1 text-white" />
                  )}
                </button>

                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-blue-400 font-semibold">
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-sm text-zinc-300 font-medium px-3 py-1 bg-zinc-800/50 rounded-full">
                      {props.block.props.fileName || "Audio Recording"}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 font-semibold">
                      {formatTime(duration)}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2.5 bg-zinc-800 rounded-full appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                          (currentTime / (duration || 1)) * 100
                        }%, #27272a ${(currentTime / (duration || 1)) * 100}%, #27272a 100%)`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                  <button
                    onClick={downloadAudio}
                    className="p-3 hover:bg-blue-600/20 rounded-lg transition-all hover:scale-110 border border-transparent hover:border-blue-500/50"
                    title="Download"
                  >
                    <FaDownload size={18} className="text-blue-400" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-3 hover:bg-red-600/20 rounded-lg transition-all hover:scale-110 border border-transparent hover:border-red-500/50"
                    title="Delete"
                  >
                    <FaTrash size={18} className="text-red-400" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      );
    },
  },
);
