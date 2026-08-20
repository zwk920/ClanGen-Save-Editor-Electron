import { contextBridge, ipcRenderer } from 'electron';

export interface OpenedFile {
  filePath: string;
  fileName: string;
  contents: string;
  companionFile?: OpenedFile;
}

export interface SavedFile {
  filePath: string;
  fileName: string;
}

export interface SavedClanFiles {
  metadataFileName: string | null;
  conditionFilesSaved: number;
  relationshipFilesSaved: number;
}

export type ConditionFiles = Record<string, Record<string, unknown>>;
export type RelationshipFiles = Record<string, Record<string, unknown>[]>;

export interface DiscoveredClan {
  name: string;
  path: string;
  gameVersion: string;
}

export interface ElectronFileSystem {
  discoverClans: () => Promise<DiscoveredClan[]>;
  selectSavesFolder: () => Promise<DiscoveredClan[]>;
  openClan: (clanPath: string) => Promise<OpenedFile>;
  openFile: () => Promise<OpenedFile | null>;
  chooseSaveFile: (fileName: string, currentPath?: string | null) => Promise<SavedFile | null>;
  writeFile: (filePath: string, contents: string) => Promise<void>;
  readClanConditions: (clanCatsPath: string) => Promise<ConditionFiles>;
  readClanRelationships: (clanCatsPath: string) => Promise<RelationshipFiles>;
  saveClanFiles: (clanCatsPath: string, cats: unknown, metadataContents?: string | null, conditionFiles?: ConditionFiles, relationshipFiles?: RelationshipFiles) => Promise<SavedClanFiles>;
  selectResourceDirectory: () => Promise<{ parentPath: string; directoryPath: string } | null>;
  readResourceFile: (directoryPath: string, relativePath: string) => Promise<string | null>;
  writeResourceFile: (directoryPath: string, relativePath: string, contents: string) => Promise<void>;
  listResourceFiles: (directoryPath: string, relativePath: string) => Promise<string[]>;
  readSpriteFile: (resourceDirectoryPath: string, relativePath: string) => Promise<string | null>;
  writeClipboardText: (text: string) => Promise<void>;
  readClipboardText: () => Promise<string>;
}

contextBridge.exposeInMainWorld('electronFileSystem', {
  discoverClans: () => ipcRenderer.invoke('clans:discover'),
  selectSavesFolder: () => ipcRenderer.invoke('clans:select-folder'),
  openClan: (clanPath: string) => ipcRenderer.invoke('clans:open', clanPath),
  openFile: () => ipcRenderer.invoke('file:open'),
  chooseSaveFile: (fileName: string, currentPath?: string | null) => ipcRenderer.invoke('file:choose-save', fileName, currentPath),
  writeFile: (filePath: string, contents: string) => ipcRenderer.invoke('file:write', filePath, contents),
  readClanConditions: (clanCatsPath: string) => ipcRenderer.invoke('clans:read-conditions', clanCatsPath),
  readClanRelationships: (clanCatsPath: string) => ipcRenderer.invoke('clans:read-relationships', clanCatsPath),
  saveClanFiles: (clanCatsPath: string, cats: unknown, metadataContents?: string | null, conditionFiles?: ConditionFiles, relationshipFiles?: RelationshipFiles) => ipcRenderer.invoke('clans:save', clanCatsPath, cats, metadataContents, conditionFiles, relationshipFiles),
  selectResourceDirectory: () => ipcRenderer.invoke('resources:select'),
  readResourceFile: (directoryPath: string, relativePath: string) => ipcRenderer.invoke('resources:read-file', directoryPath, relativePath),
  writeResourceFile: (directoryPath: string, relativePath: string, contents: string) => ipcRenderer.invoke('resources:write-file', directoryPath, relativePath, contents),
  listResourceFiles: (directoryPath: string, relativePath: string) => ipcRenderer.invoke('resources:list-files', directoryPath, relativePath),
  readSpriteFile: (resourceDirectoryPath: string, relativePath: string) => ipcRenderer.invoke('sprites:read-file', resourceDirectoryPath, relativePath),
  writeClipboardText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
  readClipboardText: () => ipcRenderer.invoke('clipboard:read-text'),
} satisfies ElectronFileSystem);