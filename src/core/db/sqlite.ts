import Database from "@tauri-apps/plugin-sql";

const DB_FILE_NAME = import.meta.env.DEV
  ? "omni_workspace_dev.db"
  : "omni_workspace.db";

export const DB_URL = `sqlite:${DB_FILE_NAME}`;

let sharedDb: Database | null = null;

export const getSharedDb = async () => {
  if (!sharedDb) {
    sharedDb = await Database.load(DB_URL);
    await sharedDb.execute("PRAGMA journal_mode = WAL;");
    await sharedDb.execute("PRAGMA foreign_keys = ON;");
    await sharedDb.execute("PRAGMA recursive_triggers = ON;");
  }
  return sharedDb;
};

export const closeSharedDb = async () => {
  if (!sharedDb) return;
  const handle: any = sharedDb as any;
  if (typeof handle.close === "function") {
    await handle.close();
  }
  sharedDb = null;
};
