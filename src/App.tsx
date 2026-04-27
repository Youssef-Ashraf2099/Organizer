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

  useEffect(() => {
    if (cursorStyle !== "default") {
      document.body.classList.add("custom-cursor");
    } else {
      document.body.classList.remove("custom-cursor");
    }
  }, [cursorStyle]);

  return (
    <>
      <CursorEffect />
      <AppLayout />
    </>
  );
}

export default App;
