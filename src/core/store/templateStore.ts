import { create } from 'zustand';
import Database from '@tauri-apps/plugin-sql';
import { Template, builtinTemplates } from '../templates/builtinTemplates';
import { PartialBlock } from '@blocknote/core';

interface TemplateStore {
    templates: Record<string, Template>;
    isLoading: boolean;
    loadTemplates: () => Promise<void>;
    createTemplate: (name: string, description: string, content: PartialBlock[], icon?: string) => Promise<string>;
    deleteTemplate: (id: string) => Promise<void>;
    getTemplate: (id: string) => Template | null;
    initializeBuiltinTemplates: () => Promise<void>;
}

let db: Database | null = null;
let isInitializing = false;

const safeGetDb = async () => {
    try {
        if (!db) {
            db = await Database.load('sqlite:omni_workspace.db');
            await db.execute('PRAGMA journal_mode = WAL;');
            await db.execute('PRAGMA foreign_keys = ON;');
        }
        return db;
    } catch (e) {
        console.error("DB ERROR:", e);
        throw e;
    }
};

export const useTemplateStore = create<TemplateStore>((set, get) => ({
    templates: {},
    isLoading: false,

    loadTemplates: async () => {
        set({ isLoading: true });
        try {
            const db = await safeGetDb();
            const rows = await db.select<any[]>(
                'SELECT * FROM templates ORDER BY is_builtin DESC, name ASC'
            );

            const templateMap: Record<string, Template> = {};

            rows.forEach((row) => {
                try {
                    const content = typeof row.content === 'string' 
                        ? JSON.parse(row.content) 
                        : row.content;
                    
                    templateMap[row.id] = {
                        id: row.id,
                        name: row.name,
                        description: row.description || '',
                        icon: row.icon,
                        content,
                        is_builtin: row.is_builtin === 1,
                    };
                } catch (e) {
                    console.error('Failed to parse template content:', e);
                }
            });

            set({ templates: templateMap });
        } catch (error) {
            console.error('Failed to load templates:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    createTemplate: async (name: string, description: string, content: PartialBlock[], icon?: string) => {
        const db = await safeGetDb();
        const id = crypto.randomUUID();
        const contentJson = JSON.stringify(content);

        await db.execute(
            'INSERT INTO templates (id, name, description, icon, content, is_builtin) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, name, description || '', icon || null, contentJson, 0]
        );

        const template: Template = {
            id,
            name,
            description: description || '',
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
            throw new Error('Cannot delete built-in templates');
        }

        const db = await safeGetDb();
        await db.execute('DELETE FROM templates WHERE id = $1', [id]);

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
            
            // Check which built-in templates already exist
            const existing = await db.select<{ id: string }[]>(
                'SELECT id FROM templates WHERE is_builtin = 1'
            );
            const existingIds = new Set(existing.map((t) => t.id));

            // Insert only missing built-in templates
            for (const template of builtinTemplates) {
                if (!existingIds.has(template.id)) {
                    const contentJson = JSON.stringify(template.content);
                    try {
                        await db.execute(
                            'INSERT INTO templates (id, name, description, icon, content, is_builtin) VALUES ($1, $2, $3, $4, $5, $6)',
                            [
                                template.id,
                                template.name,
                                template.description,
                                template.icon,
                                contentJson,
                                1,
                            ]
                        );
                    } catch (error) {
                        // If insert fails (e.g., race condition), log but don't throw
                        console.warn(`Failed to insert template ${template.id}:`, error);
                    }
                }
            }

            // Reload templates
            await get().loadTemplates();
        } finally {
            isInitializing = false;
        }
    },
}));

