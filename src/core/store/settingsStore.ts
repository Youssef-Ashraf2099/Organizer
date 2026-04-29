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

export type AppTheme =
  | "midnight"
  | "notion-gray"
  | "notion-dark"
  | "white"
  | "pink-blush"
  | "ocean-mint";

interface SettingsState {
  cursorStyle: CursorStyle;
  appTheme: AppTheme;
  setCursorStyle: (style: CursorStyle) => void;
  setAppTheme: (theme: AppTheme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      cursorStyle: "default", // Defaulting to the native OS cursor for better precision
      appTheme: "midnight",
      setCursorStyle: (style) => set({ cursorStyle: style }),
      setAppTheme: (theme) => set({ appTheme: theme }),
    }),
    {
      name: "omni-settings-storage",
    },
  ),
);
