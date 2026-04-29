import { AppLayout } from "./components/layout/AppLayout";
import { CursorEffect } from "./components/CursorEffect";
import "./index.css";
import { useEffect } from "react";
import { useTemplateStore } from "./core/store/templateStore";
import { useSettingsStore } from "./core/store/settingsStore";

function App() {
  const initializeBuiltinTemplates = useTemplateStore(
    (s) => s.initializeBuiltinTemplates
  );

  useEffect(() => {
    // Initialize built-in templates on app startup (only once)
    initializeBuiltinTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once on mount

  const cursorStyle = useSettingsStore((s) => s.cursorStyle);
  const appTheme = useSettingsStore((s) => s.appTheme);

  useEffect(() => {
    if (cursorStyle !== "default") {
      document.body.classList.add("custom-cursor");
    } else {
      document.body.classList.remove("custom-cursor");
    }
  }, [cursorStyle]);

  useEffect(() => {
    const themeClasses = [
      "theme-midnight",
      "theme-notion-gray",
      "theme-notion-dark",
      "theme-white",
      "theme-pink-blush",
      "theme-ocean-mint",
    ];

    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${appTheme}`);

    const isDarkTheme = appTheme === "midnight" || appTheme === "notion-dark";
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }, [appTheme]);

  return (
    <>
      <CursorEffect />
      <AppLayout />
    </>
  );
}

export default App;
