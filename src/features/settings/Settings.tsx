import {
  useSettingsStore,
  CursorStyle,
  AppTheme,
} from "../../core/store/settingsStore";
import { cn } from "../../lib/utils";
import { FaMousePointer } from "@react-icons/all-files/fa/FaMousePointer";
import { FaPalette } from "@react-icons/all-files/fa/FaPalette";
import { FaEnvelope } from "@react-icons/all-files/fa/FaEnvelope";

const CURSOR_OPTIONS: { id: CursorStyle; name: string; description: string; color: string }[] = [
  { 
    id: "default", 
    name: "Native System", 
    description: "Fastest response time. Uses your standard OS pointer.", 
    color: "bg-zinc-800" 
  },
  { 
    id: "voxel", 
    name: "3D Voxel", 
    description: "Classic white extruded 3D pixel cursor.", 
    color: "bg-zinc-200" 
  },
  { 
    id: "crystal", 
    name: "Crystal Voxel", 
    description: "Premium purple crystal 3D extrusion.", 
    color: "bg-purple-500" 
  },
  { 
    id: "neon", 
    name: "Neon Rainbow", 
    description: "Glowing outline with a colorful trail.", 
    color: "bg-gradient-to-r from-cyan-400 to-pink-500" 
  },
  { 
    id: "glitch", 
    name: "Cyber Glitch", 
    description: "Shifting chromatic aberration effect.", 
    color: "bg-red-500/50" 
  },
  { 
    id: "circle", 
    name: "Circle Focus", 
    description: "Modern magnetic dot and ring system.", 
    color: "bg-blue-500" 
  },
  { 
    id: "classic", 
    name: "Retro Pixel", 
    description: "Flat pixel art pointer from the 90s.", 
    color: "bg-zinc-400" 
  },
];

const THEME_OPTIONS: {
  id: AppTheme;
  name: string;
  description: string;
  preview: string;
}[] = [
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark workspace with high contrast.",
    preview: "bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-800",
  },
  {
    id: "notion-gray",
    name: "Notion Gray",
    description: "Soft gray paper-like tone inspired by Notion.",
    preview: "bg-gradient-to-r from-[#f7f7f5] via-[#efefec] to-[#e7e7e3]",
  },
  {
    id: "notion-dark",
    name: "Notion Dark",
    description: "Deep gray dark mode similar to Notion dark workspace.",
    preview: "bg-gradient-to-r from-[#2f3437] via-[#373c3f] to-[#41474a]",
  },
  {
    id: "white",
    name: "Pure White",
    description: "Bright clean layout with minimal color.",
    preview: "bg-gradient-to-r from-white via-zinc-100 to-zinc-200",
  },
  {
    id: "pink-blush",
    name: "Pink Blush",
    description: "Warm pink pastel theme for a softer look.",
    preview: "bg-gradient-to-r from-rose-50 via-pink-100 to-fuchsia-100",
  },
  {
    id: "ocean-mint",
    name: "Ocean Mint",
    description: "Cool cyan and mint inspired daytime theme.",
    preview: "bg-gradient-to-r from-cyan-50 via-teal-100 to-emerald-100",
  },
];

export const Settings = () => {
  const { cursorStyle, setCursorStyle, appTheme, setAppTheme } =
    useSettingsStore();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
          <FaPalette className="text-blue-500" />
          Settings
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Personalize your workspace experience.
        </p>
      </header>

      {/* Cursor Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <FaMousePointer className="text-zinc-400" />
          <h2 className="text-xl font-semibold">Cursor Customization</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CURSOR_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setCursorStyle(option.id)}
              className={cn(
                "group relative p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-3",
                cursorStyle === option.id
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className={cn("w-10 h-10 rounded-xl shadow-inner flex items-center justify-center", option.color)}>
                  {/* Visual hint icon */}
                  <div className="w-4 h-4 bg-white/20 rounded-full" />
                </div>
                {cursorStyle === option.id && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{option.name}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {option.description}
                </p>
              </div>

              {/* Selection hover effect */}
              <div className="absolute inset-0 rounded-2xl bg-blue-500/0 group-hover:bg-blue-500/[0.02] pointer-events-none transition-colors" />
            </button>
          ))}
        </div>
      </section>

      {/* Theme Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <FaPalette className="text-zinc-400" />
          <h2 className="text-xl font-semibold">Theme</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setAppTheme(option.id)}
              className={cn(
                "group relative p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-3",
                appTheme === option.id
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50",
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className={cn("w-16 h-10 rounded-xl shadow-inner", option.preview)} />
                {appTheme === option.id && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{option.name}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {option.description}
                </p>
              </div>

              <div className="absolute inset-0 rounded-2xl bg-blue-500/0 group-hover:bg-blue-500/[0.02] pointer-events-none transition-colors" />
            </button>
          ))}
        </div>
      </section>

      {/* Feedback Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <FaEnvelope className="text-zinc-400" />
          <h2 className="text-xl font-semibold">Feedback</h2>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 p-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Share feedback, bug reports, or suggestions:
          </p>
          <a
            href="mailto:egovertify@gmail.com"
            className="inline-flex mt-3 text-base font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            egovertify@gmail.com
          </a>
        </div>
      </section>

      {/* App Info */}
      <section className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <p>Omni Workspace v0.1.0 (Alpha)</p>
          <p>Built with Tauri & React</p>
        </div>
      </section>
    </div>
  );
};
