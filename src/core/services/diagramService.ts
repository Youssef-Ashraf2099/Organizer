import { invoke } from "@tauri-apps/api/core";

export type DiagramSourceType = "mermaid" | "svg";

export interface DiagramRecord {
  id: string;
  folderId: string;
  name: string;
  sourceType: DiagramSourceType;
  templateKey: string | null;
  code: string;
  svgMarkup: string | null;
  themePreset: string | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DiagramFolder {
  id: string;
  name: string;
  sortOrder: number;
  diagrams: DiagramRecord[];
}

export interface DiagramLibrary {
  folders: DiagramFolder[];
}

export interface SaveDiagramInput {
  id?: string | null;
  folderId: string;
  name: string;
  sourceType: DiagramSourceType;
  templateKey?: string | null;
  code: string;
  svgMarkup?: string | null;
  themePreset?: string | null;
  sortOrder?: number | null;
}

export async function getDiagramLibrary(): Promise<DiagramLibrary> {
  return await invoke<DiagramLibrary>("diagram_get_library");
}

export async function createDiagramFolder(
  name: string,
): Promise<DiagramFolder> {
  return await invoke<DiagramFolder>("diagram_create_folder", { name });
}

export async function renameDiagramFolder(
  folderId: string,
  name: string,
): Promise<void> {
  await invoke("diagram_rename_folder", { folderId, name });
}

export async function deleteDiagramFolder(folderId: string): Promise<void> {
  await invoke("diagram_delete_folder", { folderId });
}

export async function saveDiagram(
  input: SaveDiagramInput,
): Promise<DiagramRecord> {
  return await invoke<DiagramRecord>("diagram_save", { input });
}

export async function deleteDiagram(diagramId: string): Promise<void> {
  await invoke("diagram_delete", { diagramId });
}
