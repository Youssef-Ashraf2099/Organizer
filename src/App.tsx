import { AppLayout } from "./components/layout/AppLayout";
import "./index.css";
import { useEffect } from "react";
import { useTemplateStore } from "./core/store/templateStore";

function App() {
  const initializeBuiltinTemplates = useTemplateStore((s) => s.initializeBuiltinTemplates);

  useEffect(() => {
    // Initialize built-in templates on app startup (only once)
    initializeBuiltinTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once on mount

  return <AppLayout />;
}

export default App;
