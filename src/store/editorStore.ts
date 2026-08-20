import { create } from 'zustand';
import { CatDocument, validateDocument } from '../model/catDocument';
import { reconcileClanMetadata } from '../model/clanMetadata';
import {
  applyFamilyRelationshipCommand,
  type FamilyRelationshipCommand,
  type FamilyRelationshipMutationResult,
} from '../model/familyRelationshipMutation';
import { ResourceCatalog, loadResourceCatalog, mergeSpriteOptionsFromCats } from '../services/resourceCatalog';
import { createRelationshipsForNewCat, createDefaultRelationshipEntry, type RelationshipFiles } from '../model/relationships';
import {
  DesktopFileReference,
  OpenedFileReference,
  readJsonFile,
  showDirectoryPicker,
} from '../services/fileSystemAccess';

export interface DiscoveredClan {
  name: string;
  path: string;
  gameVersion: string;
}

export type ConditionFiles = Record<string, Record<string, unknown>>;
const conditionResourceRoot = 'dicts/conditions';
const definitionConditionResources = new Set([
  `${conditionResourceRoot}/illnesses.json`,
  `${conditionResourceRoot}/injuries.json`,
  `${conditionResourceRoot}/permanent_conditions.json`,
]);

interface HistorySnapshot {
  cats: Record<string, any>[] | null;
  selectedCatId: string | null;
  clanMetadataContents: string | null;
}

const historyLimit = 100;

const createHistorySnapshot = (
  document: CatDocument | null,
  selectedCatId: string | null,
  clanMetadataReference: OpenedFileReference | null,
): HistorySnapshot => ({
  cats: document ? structuredClone(document.cats) : null,
  selectedCatId,
  clanMetadataContents: clanMetadataReference?.contents ?? null,
});

const snapshotsMatch = (first: HistorySnapshot, second: HistorySnapshot | null): boolean => (
  second !== null
  && JSON.stringify(first.cats) === JSON.stringify(second.cats)
  && first.clanMetadataContents === second.clanMetadataContents
);

const removeRelationshipReferences = (relationshipFiles: RelationshipFiles, removedCatIds: string[]): RelationshipFiles => {
  const removedIds = new Set(removedCatIds.map(String));
  const result: RelationshipFiles = {};
  for (const [catId, entries] of Object.entries(relationshipFiles)) {
    if (removedIds.has(catId)) continue;
    result[catId] = entries.filter((entry) => !removedIds.has(String(entry.cat_to_id)));
  }
  return result;
};

const reconcileClanMetadataReference = (
  clanMetadataReference: OpenedFileReference | null,
  cats: Record<string, any>[],
): { reference: OpenedFileReference | null; changedFields: string[] } => {
  if (!clanMetadataReference) return { reference: null, changedFields: [] };
  try {
    const metadata = JSON.parse(clanMetadataReference.contents) as Record<string, unknown>;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return { reference: clanMetadataReference, changedFields: [] };
    const result = reconcileClanMetadata(metadata, cats.map((cat) => String(cat.ID ?? '')));
    return {
      reference: result.changedFields.length > 0
        ? { ...clanMetadataReference, contents: JSON.stringify(result.metadata, null, 2) + '\n' }
        : clanMetadataReference,
      changedFields: result.changedFields,
    };
  } catch {
    return { reference: clanMetadataReference, changedFields: [] };
  }
};

interface EditorState {
  document: CatDocument | null;
  selectedCatId: string | null;
  resourceCatalog: ResourceCatalog | null;
  saveFileReference: DesktopFileReference & { contents: string } | null;
  clanMetadataReference: OpenedFileReference | null;
  resourceDirPath: string | null;
  namesJson: string;
  namesFileDirty: boolean;
  conditionResourceFiles: string[];
  selectedConditionResourceFile: string;
  conditionResourceDrafts: Record<string, string>;
  conditionResourceDirtyFiles: string[];
  conditionFiles: ConditionFiles;
  relationshipFiles: RelationshipFiles;
  clans: DiscoveredClan[];
  selectedClanPath: string | null;
  validationIssues: ReturnType<typeof validateDocument>;
  status: string;
  dirty: boolean;
  openingFile: boolean;
  sourceFileName: string | null;
  undoHistory: HistorySnapshot[];
  redoHistory: HistorySnapshot[];
  savedSnapshot: HistorySnapshot | null;
  loadDocument: (saveFileReference?: OpenedFileReference | null) => Promise<void>;
  discoverClans: () => Promise<void>;
  selectSavesFolder: () => Promise<DiscoveredClan[]>;
  selectClan: (clanPath: string) => Promise<void>;
  openSaveFile: () => Promise<void>;
  openResourceDir: () => Promise<void>;
  saveDocument: () => Promise<void>;
  updateConditionFile: (catId: string, conditions: Record<string, unknown> | null) => void;
  updateRelationshipFile: (catId: string, relations: Record<string, unknown>[] | null) => void;
  updateClanMetadata: (patch: Record<string, unknown>) => void;
  loadNamesFile: () => Promise<void>;
  saveNamesFile: (contents: string) => Promise<void>;
  setNamesJson: (contents: string) => void;
  loadConditionResourceFiles: () => Promise<void>;
  selectConditionResourceFile: (relativePath: string) => Promise<void>;
  setConditionResourceDraft: (relativePath: string, contents: string) => void;
  saveConditionResourceFile: (relativePath?: string) => Promise<void>;
  refreshResources: () => Promise<void>;
  setSelectedCatId: (id: string | null) => void;
  addCat: (cat: Record<string, any>) => void;
  duplicateSelectedCat: () => void;
  deleteSelectedCat: () => void;
  deleteCats: (catIds: string[]) => void;
  updateCat: (catId: string, patch: Record<string, any>) => void;
  applyFamilyRelationshipCommand: (command: FamilyRelationshipCommand) => FamilyRelationshipMutationResult;
  setMateStatus: (catAId: string, catBId: string, isMate: boolean) => FamilyRelationshipMutationResult;
  undo: () => void;
  redo: () => void;
  replaceCat: (catId: string, cat: Record<string, any>) => void;
  replaceDocumentCats: (cats: unknown) => void;
  validate: () => void;
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  document: null,
  selectedCatId: null,
  resourceCatalog: null,
  saveFileReference: null,
  clanMetadataReference: null,
  resourceDirPath: null,
  namesJson: '',
  namesFileDirty: false,
  conditionResourceFiles: [],
  selectedConditionResourceFile: '',
  conditionResourceDrafts: {},
  conditionResourceDirtyFiles: [],
  conditionFiles: {},
  relationshipFiles: {},
  clans: [],
  selectedClanPath: null,
  validationIssues: [],
  status: 'No save file loaded.',
  dirty: false,
  openingFile: false,
  sourceFileName: null,
  undoHistory: [],
  redoHistory: [],
  savedSnapshot: null,

  loadDocument: async (saveFileReference = get().saveFileReference) => {
    if (!saveFileReference) return;
    try {
      const data = await readJsonFile(saveFileReference);
      const document = CatDocument.load(data, saveFileReference.fileName);
      const currentCatalog = get().resourceCatalog;
      const resourceCatalog = currentCatalog
        ? mergeSpriteOptionsFromCats(currentCatalog, document.cats)
        : null;
      let conditionFiles: ConditionFiles = {};
      try {
        conditionFiles = await window.electronFileSystem.readClanConditions(saveFileReference.filePath);
      } catch {
        // Condition files are optional, including for standalone clan_cats.json files.
      }
      let relationshipFiles: RelationshipFiles = {};
      try {
        relationshipFiles = await window.electronFileSystem.readClanRelationships(saveFileReference.filePath);
      } catch {
        // Relationship files are optional, including for standalone clan_cats.json files.
      }
      set({
        document,
        resourceCatalog,
        conditionFiles,
        relationshipFiles,
        saveFileReference,
        clanMetadataReference: saveFileReference.companionFile ?? null,
        sourceFileName: saveFileReference.fileName,
        selectedCatId: document.cats[0]?.ID ? String(document.cats[0].ID) : null,
        validationIssues: validateDocument(document, resourceCatalog?.traitRanges ?? null),
        status: `Loaded ${document.cats.length} cats from ${saveFileReference.fileName}`,
        dirty: false,
        undoHistory: [],
        redoHistory: [],
        savedSnapshot: createHistorySnapshot(document, document.cats[0]?.ID ? String(document.cats[0].ID) : null, saveFileReference.companionFile ?? null),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The selected file could not be loaded.';
      set({ status: `Open failed: ${message}` });
    }
  },

  discoverClans: async () => {
    const clans = await window.electronFileSystem.discoverClans();
    set({ clans, status: clans.length > 0 ? `Found ${clans.length} clan save folders.` : 'No clan save folders were found.' });
  },

  selectSavesFolder: async () => window.electronFileSystem.selectSavesFolder(),

  selectClan: async (clanPath) => {
    const clan = get().clans.find((entry) => entry.path === clanPath);
    if (!clan) return;
    set({ selectedClanPath: clanPath, openingFile: true, status: `Reading ${clan.name} (${clan.gameVersion})/clan_cats.json...` });
    try {
      const fileReference = await window.electronFileSystem.openClan(clanPath);
      await get().loadDocument(fileReference);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The clan save could not be opened.';
      set({ status: `Open failed: ${message}` });
    } finally {
      set({ openingFile: false });
    }
  },

  openSaveFile: async () => {
    if (get().openingFile) return;
    set({ openingFile: true, status: 'Choose the ClanGen saves folder...' });
    try {
      const clans = await get().selectSavesFolder();
      set({ clans });
      if (clans.length === 0) {
        set({ status: 'No clan save folders were found in the selected saves folder.' });
        return;
      }
      const firstClan = clans[0];
      set({ selectedClanPath: firstClan.path, status: `Reading ${firstClan.name} (${firstClan.gameVersion})/clan_cats.json...` });
      const fileReference = await window.electronFileSystem.openClan(firstClan.path);
      await get().loadDocument(fileReference);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The selected saves folder could not be opened.';
      const friendlyMessage = message.includes('File picker already active')
        ? 'A file picker is already open. Finish or close that dialog before clicking Open again.'
        : message;
      set({ status: `Open failed: ${friendlyMessage}` });
    } finally {
      set({ openingFile: false });
    }
  },

  openResourceDir: async () => {
    const directoryPath = await showDirectoryPicker();
    if (!directoryPath) return;
    set({
      resourceDirPath: directoryPath,
      conditionResourceFiles: [],
      selectedConditionResourceFile: '',
      conditionResourceDrafts: {},
      conditionResourceDirtyFiles: [],
    });
    await get().refreshResources();
    await get().loadNamesFile();
    await get().loadConditionResourceFiles();
  },

  loadNamesFile: async () => {
    const directoryPath = get().resourceDirPath;
    if (!directoryPath) return;
    try {
      const contents = await window.electronFileSystem.readResourceFile(directoryPath, 'dicts/names/names.json');
      if (!contents) throw new Error('names.json could not be read.');
      const parsed = JSON.parse(contents);
      set({ namesJson: JSON.stringify(parsed, null, 2), namesFileDirty: false, status: 'Loaded dicts/names/names.json.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'names.json could not be loaded.';
      set({ status: `Names file failed: ${message}` });
    }
  },

  saveNamesFile: async (contents) => {
    const directoryPath = get().resourceDirPath;
    if (!directoryPath) {
      set({ status: 'Choose the ClanGen data folder before saving names.json.' });
      return;
    }
    try {
      const parsed = JSON.parse(contents);
      const formatted = JSON.stringify(parsed, null, 2) + '\n';
      await window.electronFileSystem.writeResourceFile(directoryPath, 'dicts/names/names.json', formatted);
      set({ namesJson: formatted, namesFileDirty: false, status: 'Saved dicts/names/names.json.' });
    } catch (error) {
      const message = error instanceof SyntaxError ? 'The names file contains invalid JSON.' : error instanceof Error ? error.message : 'names.json could not be saved.';
      set({ status: `Names file failed: ${message}` });
    }
  },

  setNamesJson: (contents) => set({ namesJson: contents, namesFileDirty: true }),

  loadConditionResourceFiles: async () => {
    const directoryPath = get().resourceDirPath;
    if (!directoryPath) return;
    try {
      const files = await window.electronFileSystem.listResourceFiles(directoryPath, conditionResourceRoot);
      const conditionResourceFiles = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => `${conditionResourceRoot}/${file.replace(/\\/g, '/')}`)
        .sort();
      const selectedConditionResourceFile = conditionResourceFiles.includes(get().selectedConditionResourceFile)
        ? get().selectedConditionResourceFile
        : conditionResourceFiles[0] ?? '';
      set({ conditionResourceFiles, selectedConditionResourceFile });
      if (selectedConditionResourceFile && !get().conditionResourceDrafts[selectedConditionResourceFile]) {
        await get().selectConditionResourceFile(selectedConditionResourceFile);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Condition resources could not be listed.';
      set({ status: `Conditions failed: ${message}` });
    }
  },

  selectConditionResourceFile: async (relativePath) => {
    const directoryPath = get().resourceDirPath;
    if (!directoryPath || !relativePath) return;
    set({ selectedConditionResourceFile: relativePath });
    if (get().conditionResourceDrafts[relativePath] !== undefined) return;
    try {
      const contents = await window.electronFileSystem.readResourceFile(directoryPath, relativePath);
      if (!contents) throw new Error(`${relativePath} could not be read.`);
      const parsed = JSON.parse(contents);
      const formatted = JSON.stringify(parsed, null, 2) + '\n';
      set((state) => ({ conditionResourceDrafts: { ...state.conditionResourceDrafts, [relativePath]: formatted } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The condition resource could not be loaded.';
      set({ status: `Conditions failed: ${message}` });
    }
  },

  setConditionResourceDraft: (relativePath, contents) => set((state) => ({
    conditionResourceDrafts: { ...state.conditionResourceDrafts, [relativePath]: contents },
    conditionResourceDirtyFiles: state.conditionResourceDirtyFiles.includes(relativePath)
      ? state.conditionResourceDirtyFiles
      : [...state.conditionResourceDirtyFiles, relativePath],
  })),

  saveConditionResourceFile: async (relativePath = get().selectedConditionResourceFile) => {
    const directoryPath = get().resourceDirPath;
    const contents = get().conditionResourceDrafts[relativePath];
    if (!directoryPath || !relativePath || contents === undefined) {
      set({ status: 'Choose a condition resource file before saving.' });
      return;
    }
    try {
      const parsed = JSON.parse(contents);
      const formatted = JSON.stringify(parsed, null, 2) + '\n';
      await window.electronFileSystem.writeResourceFile(directoryPath, relativePath, formatted);
      set((state) => ({
        conditionResourceDrafts: { ...state.conditionResourceDrafts, [relativePath]: formatted },
        conditionResourceDirtyFiles: state.conditionResourceDirtyFiles.filter((file) => file !== relativePath),
        status: `Saved ${relativePath}.`,
      }));
      if (definitionConditionResources.has(relativePath)) await get().refreshResources();
    } catch (error) {
      const message = error instanceof SyntaxError ? 'The condition resource contains invalid JSON.' : error instanceof Error ? error.message : 'The condition resource could not be saved.';
      set({ status: `Conditions failed: ${message}` });
    }
  },

  saveDocument: async () => {
    const { document, saveFileReference: currentSaveFileReference, clanMetadataReference, conditionFiles, relationshipFiles } = get();
    if (!document || !currentSaveFileReference) {
      set({ status: 'No save file is loaded.' });
      return;
    }

    try {
      const result = await window.electronFileSystem.saveClanFiles(
        currentSaveFileReference.filePath,
        document.cats,
        clanMetadataReference?.contents ?? null,
        conditionFiles,
        relationshipFiles,
      );
      const savedMetadataReference = clanMetadataReference
        ? { ...clanMetadataReference, contents: clanMetadataReference.contents }
        : null;
      document.dirty = false;
      set({
        document,
        clanMetadataReference: savedMetadataReference,
        saveFileReference: { ...currentSaveFileReference, contents: JSON.stringify(document.cats, null, 2) + '\n' },
        status: `Saved ${document.cats.length} cats and ${result.conditionFilesSaved} condition file${result.conditionFilesSaved === 1 ? '' : 's'} to ${currentSaveFileReference.fileName}${result.metadataFileName ? ` and ${result.metadataFileName}` : ''}`,
        dirty: false,
        savedSnapshot: createHistorySnapshot(document, get().selectedCatId, savedMetadataReference),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The file could not be saved.';
      set({ status: `Save failed: ${message}` });
    }
  },

  updateConditionFile: (catId, conditions) => {
    set((state) => {
      const conditionFiles = { ...state.conditionFiles };
      if (conditions) conditionFiles[catId] = structuredClone(conditions);
      else delete conditionFiles[catId];
      return { conditionFiles, dirty: true, status: `Updated conditions for cat ${catId}.` };
    });
  },

  updateRelationshipFile: (catId, relations) => {
    set((state) => {
      const relationshipFiles = { ...state.relationshipFiles };
      if (relations) relationshipFiles[catId] = structuredClone(relations);
      else delete relationshipFiles[catId];
      return { relationshipFiles, dirty: true, status: `Updated relationships for cat ${catId}.` };
    });
  },

  updateClanMetadata: (patch) => {
    const currentReference = get().clanMetadataReference;
    if (!currentReference) return;
    try {
      const current = JSON.parse(currentReference.contents) as Record<string, unknown>;
      const contents = JSON.stringify({ ...current, ...patch }, null, 2) + '\n';
      const snapshot = createHistorySnapshot(get().document, get().selectedCatId, currentReference);
      set((state) => ({
        clanMetadataReference: { ...currentReference, contents },
        dirty: true,
        undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit),
        redoHistory: [],
      }));
    } catch {
      set({ status: 'Clan metadata could not be updated because it is not valid JSON.' });
    }
  },

  refreshResources: async () => {
    const directoryPath = get().resourceDirPath;
    if (!directoryPath) {
      set({ status: 'Choose a resource directory first.' });
      return;
    }

    const catalog = await loadResourceCatalog(directoryPath);
    set({ resourceCatalog: catalog, status: 'Resources refreshed.' });
    const document = get().document;
    if (document) {
      const catalogWithSprites = mergeSpriteOptionsFromCats(catalog, document.cats);
      set({ resourceCatalog: catalogWithSprites, validationIssues: validateDocument(document, catalogWithSprites.traitRanges) });
    }
  },

  setSelectedCatId: (id) => set({ selectedCatId: id }),

  addCat: (cat) => {
    const { document } = get();
    if (!document) return;
    const snapshot = createHistorySnapshot(document, get().selectedCatId, get().clanMetadataReference);
    const added = document.addCat(cat);
    const newCatId = String(added.ID);
    const { newCatEntries, reciprocalEntriesByCatId } = createRelationshipsForNewCat(newCatId, document.cats);
    const relationshipFiles = { ...get().relationshipFiles };
    relationshipFiles[newCatId] = newCatEntries;
    for (const [otherId, entry] of Object.entries(reciprocalEntriesByCatId)) {
      relationshipFiles[otherId] = [...(relationshipFiles[otherId] ?? []), entry];
    }
    set((state) => ({ document, relationshipFiles, selectedCatId: newCatId, dirty: true, status: `Added cat ${added.ID}`, undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit), redoHistory: [] }));
  },

  duplicateSelectedCat: () => {
    const { document, selectedCatId } = get();
    if (!document || !selectedCatId) return;
    const snapshot = createHistorySnapshot(document, selectedCatId, get().clanMetadataReference);
    const duplicate = document.cloneCat(selectedCatId);
    set((state) => ({ document, selectedCatId: String(duplicate.ID), dirty: true, status: `Duplicated cat ${selectedCatId}`, undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit), redoHistory: [] }));
  },

  deleteSelectedCat: () => {
    const { document, selectedCatId } = get();
    if (!document || !selectedCatId) return;
    const snapshot = createHistorySnapshot(document, selectedCatId, get().clanMetadataReference);
    document.deleteCat(selectedCatId);
    const metadataResult = reconcileClanMetadataReference(get().clanMetadataReference, document.cats);
    const conditionFiles = { ...get().conditionFiles };
    delete conditionFiles[selectedCatId];
    const relationshipFiles = removeRelationshipReferences(get().relationshipFiles, [selectedCatId]);
    set((state) => ({
      document,
      clanMetadataReference: metadataResult.reference,
      conditionFiles,
      relationshipFiles,
      selectedCatId: document.cats[0]?.ID ? String(document.cats[0].ID) : null,
      dirty: true,
      status: `Deleted cat ${selectedCatId}${metadataResult.changedFields.length > 0 ? ` and cleared ${metadataResult.changedFields.length} companion reference${metadataResult.changedFields.length === 1 ? '' : 's'}` : ''}.`,
      undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit),
      redoHistory: [],
    }));
  },

  deleteCats: (catIds) => {
    const { document } = get();
    if (!document || catIds.length === 0) return;
    const snapshot = createHistorySnapshot(document, get().selectedCatId, get().clanMetadataReference);
    document.deleteCats(catIds);
    const metadataResult = reconcileClanMetadataReference(get().clanMetadataReference, document.cats);
    const conditionFiles = { ...get().conditionFiles };
    for (const catId of catIds) delete conditionFiles[catId];
    const relationshipFiles = removeRelationshipReferences(get().relationshipFiles, catIds);
    const selectedCatId = get().selectedCatId;
    const nextSelectedCatId = selectedCatId && document.getCat(selectedCatId)
      ? selectedCatId
      : document.cats[0]?.ID ? String(document.cats[0].ID) : null;
    set((state) => ({
      document,
      clanMetadataReference: metadataResult.reference,
      conditionFiles,
      relationshipFiles,
      selectedCatId: nextSelectedCatId,
      dirty: true,
      status: `Deleted ${catIds.length} cats${metadataResult.changedFields.length > 0 ? ` and cleared ${metadataResult.changedFields.length} companion reference${metadataResult.changedFields.length === 1 ? '' : 's'}` : ''}.`,
      undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit),
      redoHistory: [],
    }));
  },

  updateCat: (catId, patch) => {
    const currentDocument = get().document;
    if (!currentDocument) return;
    const cat = currentDocument.getCat(catId);
    if (!cat) return;
    const snapshot = createHistorySnapshot(currentDocument, get().selectedCatId, get().clanMetadataReference);
    const document = CatDocument.load(currentDocument.cats, currentDocument.sourcePath);
    document.updateCat(catId, { ...cat, ...patch });
    document.dirty = true;
    set((state) => ({ document, dirty: true, validationIssues: validateDocument(document, get().resourceCatalog?.traitRanges ?? null), undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit), redoHistory: [] }));
  },

  applyFamilyRelationshipCommand: (command) => {
    const currentDocument = get().document;
    if (!currentDocument) return { kind: 'rejected', message: 'No save file is loaded.' };
    const result = applyFamilyRelationshipCommand(currentDocument.cats, command);
    if (result.kind !== 'success') return result;

    const snapshot = createHistorySnapshot(currentDocument, get().selectedCatId, get().clanMetadataReference);
    const document = CatDocument.load(result.cats, currentDocument.sourcePath);
    document.dirty = true;
    set((state) => ({
      document,
      dirty: true,
      validationIssues: validateDocument(document, get().resourceCatalog?.traitRanges ?? null),
      status: result.message,
      undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit),
      redoHistory: [],
    }));
    return result;
  },

  setMateStatus: (catAId, catBId, isMate) => {
    const currentDocument = get().document;
    if (!currentDocument) return { kind: 'rejected', message: 'No save file is loaded.' };
    const sourceId = String(catAId);
    const targetId = String(catBId);
    if (!sourceId || !targetId || sourceId === targetId) return { kind: 'rejected', message: 'Choose two different cats.' };
    if (!currentDocument.getCat(sourceId) || !currentDocument.getCat(targetId)) {
      return { kind: 'rejected', message: 'One of the selected cats no longer exists in this save.' };
    }

    // The array mutation may reject as a no-op (e.g. already mates); the relationships/ sync below still needs to run to fix any pre-existing desync.
    const mutation = applyFamilyRelationshipCommand(currentDocument.cats, {
      operation: isMate ? 'add' : 'remove',
      relationship: 'mate',
      sourceId,
      targetId,
    });
    const nextCats = mutation.kind === 'success' ? mutation.cats : currentDocument.cats;

    const snapshot = createHistorySnapshot(currentDocument, get().selectedCatId, get().clanMetadataReference);
    const document = CatDocument.load(nextCats, currentDocument.sourcePath);
    document.dirty = true;

    const relationshipFiles = { ...get().relationshipFiles };
    for (const [fromId, toId] of [[sourceId, targetId], [targetId, sourceId]] as const) {
      const entries = relationshipFiles[fromId] ?? [];
      const index = entries.findIndex((entry) => String(entry.cat_to_id) === toId);
      relationshipFiles[fromId] = index >= 0
        ? entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, mates: isMate } : entry))
        : [...entries, { ...createDefaultRelationshipEntry(fromId, toId), mates: isMate }];
    }

    const message = mutation.kind === 'success' ? mutation.message : `Synced mate status for cats ${sourceId} and ${targetId}.`;
    set((state) => ({
      document,
      relationshipFiles,
      dirty: true,
      validationIssues: validateDocument(document, get().resourceCatalog?.traitRanges ?? null),
      status: message,
      undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit),
      redoHistory: [],
    }));

    return { kind: 'success', cats: nextCats, message };
  },

  undo: () => {
    const state = get();
    const snapshot = state.undoHistory.at(-1);
    if (!snapshot) return;
    const currentSnapshot = createHistorySnapshot(state.document, state.selectedCatId, state.clanMetadataReference);
    const document = snapshot.cats ? CatDocument.load(snapshot.cats, state.document?.sourcePath ?? null) : null;
    const clanMetadataReference = state.clanMetadataReference && snapshot.clanMetadataContents !== null
      ? { ...state.clanMetadataReference, contents: snapshot.clanMetadataContents }
      : state.clanMetadataReference;
    const restoredSnapshot = createHistorySnapshot(document, snapshot.selectedCatId, clanMetadataReference);
    set({
      document,
      clanMetadataReference,
      selectedCatId: snapshot.selectedCatId,
      validationIssues: document ? validateDocument(document, state.resourceCatalog?.traitRanges ?? null) : [],
      dirty: !snapshotsMatch(restoredSnapshot, state.savedSnapshot),
      undoHistory: state.undoHistory.slice(0, -1),
      redoHistory: [...state.redoHistory, currentSnapshot].slice(-historyLimit),
      status: 'Undid the last edit.',
    });
  },

  redo: () => {
    const state = get();
    const snapshot = state.redoHistory.at(-1);
    if (!snapshot) return;
    const currentSnapshot = createHistorySnapshot(state.document, state.selectedCatId, state.clanMetadataReference);
    const document = snapshot.cats ? CatDocument.load(snapshot.cats, state.document?.sourcePath ?? null) : null;
    const clanMetadataReference = state.clanMetadataReference && snapshot.clanMetadataContents !== null
      ? { ...state.clanMetadataReference, contents: snapshot.clanMetadataContents }
      : state.clanMetadataReference;
    const restoredSnapshot = createHistorySnapshot(document, snapshot.selectedCatId, clanMetadataReference);
    set({
      document,
      clanMetadataReference,
      selectedCatId: snapshot.selectedCatId,
      validationIssues: document ? validateDocument(document, state.resourceCatalog?.traitRanges ?? null) : [],
      dirty: !snapshotsMatch(restoredSnapshot, state.savedSnapshot),
      undoHistory: [...state.undoHistory, currentSnapshot].slice(-historyLimit),
      redoHistory: state.redoHistory.slice(0, -1),
      status: 'Redid the last edit.',
    });
  },

  replaceCat: (catId, cat) => {
    const currentDocument = get().document;
    if (!currentDocument) return;
    const snapshot = createHistorySnapshot(currentDocument, get().selectedCatId, get().clanMetadataReference);
    const document = CatDocument.load(currentDocument.cats, currentDocument.sourcePath);
    document.updateCat(catId, { ...cat, ID: catId });
    document.dirty = true;
    set((state) => ({
      document,
      dirty: true,
      validationIssues: validateDocument(document, get().resourceCatalog?.traitRanges ?? null),
      status: `Imported cat ${catId} from pasted JSON.`,
      undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit),
      redoHistory: [],
    }));
  },

  replaceDocumentCats: (cats) => {
    const currentDocument = get().document;
    if (!currentDocument) throw new Error('No save file is loaded.');
    const snapshot = createHistorySnapshot(currentDocument, get().selectedCatId, get().clanMetadataReference);
    const document = CatDocument.load(cats, currentDocument.sourcePath);
    document.dirty = true;
    const metadataResult = reconcileClanMetadataReference(get().clanMetadataReference, document.cats);
    const currentCatalog = get().resourceCatalog;
    const resourceCatalog = currentCatalog
      ? mergeSpriteOptionsFromCats(currentCatalog, document.cats)
      : null;
    const selectedCatId = get().selectedCatId;
    const selectedCat = selectedCatId ? document.getCat(selectedCatId) : null;
    set((state) => ({
      document,
      clanMetadataReference: metadataResult.reference,
      resourceCatalog,
      selectedCatId: selectedCat?.ID ? String(selectedCat.ID) : document.cats[0]?.ID ? String(document.cats[0].ID) : null,
      validationIssues: validateDocument(document, resourceCatalog?.traitRanges ?? null),
      status: `Applied JSON for ${document.cats.length} cats${metadataResult.changedFields.length > 0 ? ` and cleared ${metadataResult.changedFields.length} companion reference${metadataResult.changedFields.length === 1 ? '' : 's'}` : ''}.`,
      dirty: true,
      undoHistory: [...state.undoHistory, snapshot].slice(-historyLimit),
      redoHistory: [],
    }));
  },

  validate: () => {
    const document = get().document;
    if (!document) return;
    set({ validationIssues: validateDocument(document, get().resourceCatalog?.traitRanges ?? null), status: 'Validation completed.' });
  },
}));
