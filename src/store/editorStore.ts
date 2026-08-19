import { create } from 'zustand';
import { CatDocument, validateDocument } from '../model/catDocument';
import { ResourceCatalog, loadResourceCatalog, mergeSpriteOptionsFromCats } from '../services/resourceCatalog';
import {
  DesktopFileReference,
  OpenedFileReference,
  readJsonFile,
  showDirectoryPicker,
} from '../services/fileSystemAccess';

export interface DiscoveredClan {
  name: string;
  path: string;
}

interface EditorState {
  document: CatDocument | null;
  selectedCatId: string | null;
  resourceCatalog: ResourceCatalog | null;
  saveFileReference: DesktopFileReference & { contents: string } | null;
  clanMetadataReference: OpenedFileReference | null;
  resourceDirPath: string | null;
  namesJson: string;
  namesFileDirty: boolean;
  clans: DiscoveredClan[];
  selectedClanPath: string | null;
  validationIssues: ReturnType<typeof validateDocument>;
  status: string;
  dirty: boolean;
  openingFile: boolean;
  sourceFileName: string | null;
  loadDocument: (saveFileReference?: OpenedFileReference | null) => Promise<void>;
  discoverClans: () => Promise<void>;
  selectSavesFolder: () => Promise<DiscoveredClan[]>;
  selectClan: (clanPath: string) => Promise<void>;
  openSaveFile: () => Promise<void>;
  openResourceDir: () => Promise<void>;
  saveDocument: () => Promise<void>;
  loadNamesFile: () => Promise<void>;
  saveNamesFile: (contents: string) => Promise<void>;
  setNamesJson: (contents: string) => void;
  refreshResources: () => Promise<void>;
  setSelectedCatId: (id: string | null) => void;
  addCat: (cat: Record<string, any>) => void;
  duplicateSelectedCat: () => void;
  deleteSelectedCat: () => void;
  deleteCats: (catIds: string[]) => void;
  updateCat: (catId: string, patch: Record<string, any>) => void;
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
  clans: [],
  selectedClanPath: null,
  validationIssues: [],
  status: 'No save file loaded.',
  dirty: false,
  openingFile: false,
  sourceFileName: null,

  loadDocument: async (saveFileReference = get().saveFileReference) => {
    if (!saveFileReference) return;
    try {
      const data = await readJsonFile(saveFileReference);
      const document = CatDocument.load(data, saveFileReference.fileName);
      const currentCatalog = get().resourceCatalog;
      const resourceCatalog = currentCatalog
        ? mergeSpriteOptionsFromCats(currentCatalog, document.cats)
        : null;
      set({
        document,
        resourceCatalog,
        saveFileReference,
        clanMetadataReference: saveFileReference.companionFile ?? null,
        sourceFileName: saveFileReference.fileName,
        selectedCatId: document.cats[0]?.ID ? String(document.cats[0].ID) : null,
        validationIssues: validateDocument(document, resourceCatalog?.traitRanges ?? null),
        status: `Loaded ${document.cats.length} cats from ${saveFileReference.fileName}`,
        dirty: false,
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
    set({ selectedClanPath: clanPath, openingFile: true, status: `Reading ${clan.name}/clan_cats.json...` });
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
      set({ selectedClanPath: firstClan.path, status: `Reading ${firstClan.name}/clan_cats.json...` });
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
    set({ resourceDirPath: directoryPath });
    await get().refreshResources();
    await get().loadNamesFile();
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

  saveDocument: async () => {
    const { document, saveFileReference: currentSaveFileReference, clanMetadataReference } = get();
    if (!document || !currentSaveFileReference) {
      set({ status: 'No save file is loaded.' });
      return;
    }

    try {
      const result = await window.electronFileSystem.saveClanFiles(currentSaveFileReference.filePath, document.cats);
      document.dirty = false;
      set({
        document,
        saveFileReference: { ...currentSaveFileReference, contents: JSON.stringify(document.cats, null, 2) + '\n' },
        status: `Saved ${document.cats.length} cats to ${currentSaveFileReference.fileName}${result.metadataFileName ? ` and ${result.metadataFileName}` : ''}`,
        dirty: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The file could not be saved.';
      set({ status: `Save failed: ${message}` });
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
    const added = document.addCat(cat);
    set({ document, selectedCatId: String(added.ID), dirty: true, status: `Added cat ${added.ID}` });
  },

  duplicateSelectedCat: () => {
    const { document, selectedCatId } = get();
    if (!document || !selectedCatId) return;
    const duplicate = document.cloneCat(selectedCatId);
    set({ document, selectedCatId: String(duplicate.ID), dirty: true, status: `Duplicated cat ${selectedCatId}` });
  },

  deleteSelectedCat: () => {
    const { document, selectedCatId } = get();
    if (!document || !selectedCatId) return;
    document.deleteCat(selectedCatId);
    set({ document, selectedCatId: document.cats[0]?.ID ? String(document.cats[0].ID) : null, dirty: true, status: `Deleted cat ${selectedCatId}` });
  },

  deleteCats: (catIds) => {
    const { document } = get();
    if (!document || catIds.length === 0) return;
    document.deleteCats(catIds);
    const selectedCatId = get().selectedCatId;
    const nextSelectedCatId = selectedCatId && document.getCat(selectedCatId)
      ? selectedCatId
      : document.cats[0]?.ID ? String(document.cats[0].ID) : null;
    set({ document, selectedCatId: nextSelectedCatId, dirty: true, status: `Deleted ${catIds.length} cats` });
  },

  updateCat: (catId, patch) => {
    const currentDocument = get().document;
    if (!currentDocument) return;
    const cat = currentDocument.getCat(catId);
    if (!cat) return;
    const document = CatDocument.load(currentDocument.cats, currentDocument.sourcePath);
    document.updateCat(catId, { ...cat, ...patch });
    document.dirty = true;
    set({ document, dirty: true, validationIssues: validateDocument(document, get().resourceCatalog?.traitRanges ?? null) });
  },

  replaceDocumentCats: (cats) => {
    const currentDocument = get().document;
    if (!currentDocument) throw new Error('No save file is loaded.');
    const document = CatDocument.load(cats, currentDocument.sourcePath);
    document.dirty = true;
    const currentCatalog = get().resourceCatalog;
    const resourceCatalog = currentCatalog
      ? mergeSpriteOptionsFromCats(currentCatalog, document.cats)
      : null;
    const selectedCatId = get().selectedCatId;
    const selectedCat = selectedCatId ? document.getCat(selectedCatId) : null;
    set({
      document,
      resourceCatalog,
      selectedCatId: selectedCat?.ID ? String(selectedCat.ID) : document.cats[0]?.ID ? String(document.cats[0].ID) : null,
      validationIssues: validateDocument(document, resourceCatalog?.traitRanges ?? null),
      status: `Applied JSON for ${document.cats.length} cats.`,
      dirty: true,
    });
  },

  validate: () => {
    const document = get().document;
    if (!document) return;
    set({ validationIssues: validateDocument(document, get().resourceCatalog?.traitRanges ?? null), status: 'Validation completed.' });
  },
}));
