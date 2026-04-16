import { create } from "zustand";
import {
  createDiagramFolder,
  deleteDiagram,
  deleteDiagramFolder,
  getDiagramLibrary,
  renameDiagramFolder,
  saveDiagram,
  type DiagramFolder,
  type DiagramRecord,
  type SaveDiagramInput,
} from "../services/diagramService";

interface DiagramState {
  folders: DiagramFolder[];
  activeFolderId: string | null;
  activeDiagramId: string | null;
  isLoading: boolean;
  error: string | null;
  loadLibrary: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  setActiveFolder: (folderId: string | null) => void;
  setActiveDiagram: (diagramId: string | null) => void;
  createFolder: (name: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  removeFolder: (folderId: string) => Promise<void>;
  createDiagram: (
    input: Omit<SaveDiagramInput, "id">,
  ) => Promise<DiagramRecord | null>;
  updateDiagram: (
    diagramId: string,
    input: Omit<SaveDiagramInput, "id">,
  ) => Promise<void>;
  removeDiagram: (diagramId: string) => Promise<void>;
}

const selectInitialTargets = (folders: DiagramFolder[]) => {
  const firstFolder = folders[0] ?? null;
  const firstDiagram = firstFolder?.diagrams[0] ?? null;

  return {
    activeFolderId: firstFolder?.id ?? null,
    activeDiagramId: firstDiagram?.id ?? null,
  };
};

export const useDiagramStore = create<DiagramState>((set, get) => ({
  folders: [],
  activeFolderId: null,
  activeDiagramId: null,
  isLoading: false,
  error: null,

  loadLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const library = await getDiagramLibrary();
      const activeState = get();
      const folderStillExists = library.folders.some(
        (folder) => folder.id === activeState.activeFolderId,
      );
      const diagramStillExists = library.folders.some((folder) =>
        folder.diagrams.some(
          (diagram) => diagram.id === activeState.activeDiagramId,
        ),
      );

      const initialTargets =
        folderStillExists && diagramStillExists
          ? {
              activeFolderId: activeState.activeFolderId,
              activeDiagramId: activeState.activeDiagramId,
            }
          : selectInitialTargets(library.folders);

      set({
        folders: library.folders,
        ...initialTargets,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to load diagrams",
      });
    }
  },

  refreshLibrary: async () => {
    await get().loadLibrary();
  },

  setActiveFolder: (folderId) => {
    const folder = get().folders.find((item) => item.id === folderId) ?? null;
    set({
      activeFolderId: folderId,
      activeDiagramId: folder?.diagrams[0]?.id ?? null,
    });
  },

  setActiveDiagram: (diagramId) => {
    const folder = get().folders.find((item) =>
      item.diagrams.some((diagram) => diagram.id === diagramId),
    );
    set({
      activeFolderId: folder?.id ?? get().activeFolderId,
      activeDiagramId: diagramId,
    });
  },

  createFolder: async (name) => {
    set({ error: null });
    try {
      const folder = await createDiagramFolder(name);
      set((state) => ({
        folders: [...state.folders, folder].sort(
          (left, right) => left.sortOrder - right.sortOrder,
        ),
        activeFolderId: folder.id,
        activeDiagramId: null,
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to create folder",
      });
    }
  },

  renameFolder: async (folderId, name) => {
    set({ error: null });
    try {
      await renameDiagramFolder(folderId, name);
      set((state) => ({
        folders: state.folders.map((folder) =>
          folder.id === folderId ? { ...folder, name } : folder,
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to rename folder",
      });
    }
  },

  removeFolder: async (folderId) => {
    set({ error: null });
    try {
      await deleteDiagramFolder(folderId);
      const nextFolders = get().folders.filter(
        (folder) => folder.id !== folderId,
      );
      const nextTargets = selectInitialTargets(nextFolders);
      set({
        folders: nextFolders,
        ...nextTargets,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to delete folder",
      });
    }
  },

  createDiagram: async (input) => {
    set({ error: null });
    try {
      const diagram = await saveDiagram({
        ...input,
        id: null,
      });
      set((state) => ({
        folders: state.folders.map((folder) => {
          if (folder.id !== diagram.folderId) {
            return folder;
          }

          const diagrams = [...folder.diagrams, diagram].sort(
            (left, right) => left.sortOrder - right.sortOrder,
          );
          return { ...folder, diagrams };
        }),
        activeFolderId: diagram.folderId,
        activeDiagramId: diagram.id,
      }));
      return diagram;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to create diagram",
      });
      return null;
    }
  },

  updateDiagram: async (diagramId, input) => {
    set({ error: null });
    try {
      const updated = await saveDiagram({
        ...input,
        id: diagramId,
      });

      set((state) => {
        const nextFolders = state.folders.map((folder) => ({
          ...folder,
          diagrams: folder.diagrams.filter(
            (diagram) => diagram.id !== diagramId,
          ),
        }));

        const targetFolderIndex = nextFolders.findIndex(
          (folder) => folder.id === updated.folderId,
        );
        if (targetFolderIndex >= 0) {
          nextFolders[targetFolderIndex] = {
            ...nextFolders[targetFolderIndex],
            diagrams: [
              ...nextFolders[targetFolderIndex].diagrams,
              updated,
            ].sort((left, right) => left.sortOrder - right.sortOrder),
          };
        }

        return {
          folders: nextFolders,
          activeFolderId: updated.folderId,
          activeDiagramId: updated.id,
        };
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to update diagram",
      });
    }
  },

  removeDiagram: async (diagramId) => {
    set({ error: null });
    try {
      await deleteDiagram(diagramId);
      const nextFolders = get().folders.map((folder) => ({
        ...folder,
        diagrams: folder.diagrams.filter((diagram) => diagram.id !== diagramId),
      }));
      const activeFolder =
        nextFolders.find((folder) => folder.id === get().activeFolderId) ??
        nextFolders[0] ??
        null;
      set({
        folders: nextFolders,
        activeFolderId: activeFolder?.id ?? null,
        activeDiagramId: activeFolder?.diagrams[0]?.id ?? null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to delete diagram",
      });
    }
  },
}));
