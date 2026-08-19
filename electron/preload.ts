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
}

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
  saveClanFiles: (clanCatsPath: string, cats: unknown, metadataContents?: string | null) => Promise<SavedClanFiles>;
  selectResourceDirectory: () => Promise<{ parentPath: string; directoryPath: string } | null>;
  readResourceFile: (directoryPath: string, relativePath: string) => Promise<string | null>;
  writeResourceFile: (directoryPath: string, relativePath: string, contents: string) => Promise<void>;
  listResourceFiles: (directoryPath: string, relativePath: string) => Promise<string[]>;
  readSpriteFile: (resourceDirectoryPath: string, relativePath: string) => Promise<string | null>;
}

contextBridge.exposeInMainWorld('electronFileSystem', {
  discoverClans: () => ipcRenderer.invoke('clans:discover'),
  selectSavesFolder: () => ipcRenderer.invoke('clans:select-folder'),
  openClan: (clanPath: string) => ipcRenderer.invoke('clans:open', clanPath),
  openFile: () => ipcRenderer.invoke('file:open'),
  chooseSaveFile: (fileName: string, currentPath?: string | null) => ipcRenderer.invoke('file:choose-save', fileName, currentPath),
  writeFile: (filePath: string, contents: string) => ipcRenderer.invoke('file:write', filePath, contents),
  saveClanFiles: (clanCatsPath: string, cats: unknown, metadataContents?: string | null) => ipcRenderer.invoke('clans:save', clanCatsPath, cats, metadataContents),
  selectResourceDirectory: () => ipcRenderer.invoke('resources:select'),
  readResourceFile: (directoryPath: string, relativePath: string) => ipcRenderer.invoke('resources:read-file', directoryPath, relativePath),
  writeResourceFile: (directoryPath: string, relativePath: string, contents: string) => ipcRenderer.invoke('resources:write-file', directoryPath, relativePath, contents),
  listResourceFiles: (directoryPath: string, relativePath: string) => ipcRenderer.invoke('resources:list-files', directoryPath, relativePath),
  readSpriteFile: (resourceDirectoryPath: string, relativePath: string) => ipcRenderer.invoke('sprites:read-file', resourceDirectoryPath, relativePath),
} satisfies ElectronFileSystem);