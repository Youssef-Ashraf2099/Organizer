import { create } from "zustand";
import type Database from "@tauri-apps/plugin-sql";
import { getSharedDb } from "../db/sqlite";
import { Template, builtinTemplates } from "../templates/builtinTemplates";
import { PartialBlock } from "@blocknote/core";

interface TemplateStore {
  templates: Record<string, Template>;
  isLoading: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (
    name: string,
    description: string,
    content: PartialBlock[],
    icon?: string,
  ) => Promise<string>;
  deleteTemplate: (id: string) => Promise<void>;
  getTemplate: (id: string) => Template | null;
  initializeBuiltinTemplates: () => Promise<void>;
}

let db: Database | null = null;
let isInitializing = false;

const WEB_TEMPLATE_STORAGE_KEY = "omni-web-templates";

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

const loadWebTemplates = (): Template[] => {
  try {
    const raw = localStorage.getItem(WEB_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveWebTemplates = (templates: Template[]) => {
  localStorage.setItem(WEB_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
};

const toTemplateMap = (templates: Template[]) => {
  const templateMap: Record<string, Template> = {};
  templates.forEach((template) => {
    templateMap[template.id] = template;
  });
  return templateMap;
};

const safeGetDb = async () => {
  try {
    if (!isTauriRuntime()) {
      return null;
    }
    if (!db) {
      db = await getSharedDb();
    }
    return db;
  } catch (e) {
    console.error("DB ERROR:", e);
    return null;
  }
};

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: {},
  isLoading: false,

  loadTemplates: async () => {
    set({ isLoading: true });
    try {
      const db = await safeGetDb();
      if (!db) {
        const merged = [...builtinTemplates, ...loadWebTemplates()];
        set({ templates: toTemplateMap(merged) });
        return;
      }
      const rows = await db.select<any[]>(
        "SELECT * FROM templates ORDER BY is_builtin DESC, name ASC",
      );

      const templateMap: Record<string, Template> = {};

      rows.forEach((row) => {
        try {
          const content =
            typeof row.content === "string"
              ? JSON.parse(row.content)
              : row.content;

          templateMap[row.id] = {
            id: row.id,
            name: row.name,
            description: row.description || "",
            icon: row.icon,
            content,
            is_builtin: row.is_builtin === 1,
          };
        } catch (e) {
          console.error("Failed to parse template content:", e);
        }
      });

      set({ templates: templateMap });
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createTemplate: async (
    name: string,
    description: string,
    content: PartialBlock[],
    icon?: string,
  ) => {
    const db = await safeGetDb();
    const id = crypto.randomUUID();
    const contentJson = JSON.stringify(content);

    if (!db) {
      const template: Template = {
        id,
        name,
        description: description || "",
        icon: icon || null,
        content,
        is_builtin: false,
      };
      const webTemplates = loadWebTemplates();
      saveWebTemplates([...webTemplates, template]);
      set((state) => ({
        templates: { ...state.templates, [id]: template },
      }));
      return id;
    }

    await db.execute(
      "INSERT INTO templates (id, name, description, icon, content, is_builtin) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, name, description || "", icon || null, contentJson, 0],
    );

    const template: Template = {
      id,
      name,
      description: description || "",
      icon: icon || null,
      content,
      is_builtin: false,
    };

    set((state) => ({
      templates: { ...state.templates, [id]: template },
    }));

    return id;
  },

  deleteTemplate: async (id: string) => {
    const template = get().templates[id];
    if (template?.is_builtin) {
      throw new Error("Cannot delete built-in templates");
    }

    const db = await safeGetDb();
    if (db) {
      await db.execute("DELETE FROM templates WHERE id = $1", [id]);
    } else {
      const nextWebTemplates = loadWebTemplates().filter((t) => t.id !== id);
      saveWebTemplates(nextWebTemplates);
    }

    set((state) => {
      const newTemplates = { ...state.templates };
      delete newTemplates[id];
      return { templates: newTemplates };
    });
  },

  getTemplate: (id: string) => {
    return get().templates[id] || null;
  },

  initializeBuiltinTemplates: async () => {
    // Prevent concurrent initialization
    if (isInitializing) {
      return;
    }

    isInitializing = true;
    try {
      const db = await safeGetDb();
      if (!db) {
        const merged = [...builtinTemplates, ...loadWebTemplates()];
        set({ templates: toTemplateMap(merged) });
        return;
      }

      // We want to ensure the DB matches the code for built-in templates.
      // Simplest strategy: Upsert all built-in templates.

      for (const template of builtinTemplates) {
        const contentJson = JSON.stringify(template.content);
        try {
          // Check if it exists to decide on INSERT or UPDATE (SQLite supports UPSERT but syntax varies,
          // simple SELECT check is portable enough alongside explicit UPDATE)
          const existing = await db.select<any[]>(
            "SELECT id FROM templates WHERE id = $1",
            [template.id],
          );

          if (existing.length > 0) {
            await db.execute(
              "UPDATE templates SET name=$1, description=$2, icon=$3, content=$4, is_builtin=1 WHERE id=$5",
              [
                template.name,
                template.description,
                template.icon,
                contentJson,
                template.id,
              ],
            );
          } else {
            await db.execute(
              "INSERT INTO templates (id, name, description, icon, content, is_builtin) VALUES ($1, $2, $3, $4, $5, $6)",
              [
                template.id,
                template.name,
                template.description,
                template.icon,
                contentJson,
                1,
              ],
            );
          }
        } catch (error) {
          console.warn(`Failed to upsert template ${template.id}:`, error);
        }
      }

      // Reload templates
      await get().loadTemplates();
    } finally {
      isInitializing = false;
    }
  },
}));
