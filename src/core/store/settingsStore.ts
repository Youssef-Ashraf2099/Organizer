import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CursorStyle =
  | "default"
  | "classic"
  | "voxel"
  | "neon"
  | "glitch"
  | "crystal"
  | "circle";

interface SettingsState {
  cursorStyle: CursorStyle;
  setCursorStyle: (style: CursorStyle) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      cursorStyle: "default", // Defaulting to the native OS cursor for better precision
      setCursorStyle: (style) => set({ cursorStyle: style }),
    }),
    {
      name: "omni-settings-storage",
    },
  ),
);
