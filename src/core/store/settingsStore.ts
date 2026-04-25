import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CursorStyle = "default" | "classic" | "voxel" | "neon" | "glitch" | "crystal";

interface SettingsState {
  cursorStyle: CursorStyle;
  setCursorStyle: (style: CursorStyle) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      cursorStyle: "voxel", // Defaulting to the cool 3D one we just made
      setCursorStyle: (style) => set({ cursorStyle: style }),
    }),
    {
      name: "omni-settings-storage",
    }
  )
);
