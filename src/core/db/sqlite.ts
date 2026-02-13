import Database from "@tauri-apps/plugin-sql";

const DB_FILE_NAME = import.meta.env.DEV
  ? "omni_workspace_dev.db"
  : "omni_workspace.db";

export const DB_URL = `sqlite:${DB_FILE_NAME}`;

let sharedDb: Database | null = null;

export const getSharedDb = async () => {
  if (!sharedDb) {
    sharedDb = await Database.load(DB_URL);
  }
  return sharedDb;
};
