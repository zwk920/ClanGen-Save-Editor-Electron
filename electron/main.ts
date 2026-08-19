import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isDevelopment = Boolean(process.env.ELECTRON_START_URL);
const localAppDataPath = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
const appDataPath = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
const defaultSavesPaths = [
  path.join(localAppDataPath, 'LifeGen', 'LifeGen', 'saves'),
  path.join(localAppDataPath, 'ClanGen', 'ClanGen', 'saves'),
  path.join(localAppDataPath, 'ClanGen', 'saves'),
  path.join(appDataPath, 'ClanGen', 'saves'),
].map((savePath) => path.resolve(savePath));
const allowedSavesRoots = new Set(defaultSavesPaths);

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDevelopment) {
    void window.loadURL(process.env.ELECTRON_START_URL!);
  } else {
    void window.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }
}

function registerFileHandlers(): void {
  ipcMain.handle('clans:discover', async () => discoverClanFolders());

  ipcMain.handle('clans:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select the ClanGen saves folder',
      message: 'Choose the folder containing your clan save folders.',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    const selectedPath = path.resolve(result.filePaths[0]);
    allowedSavesRoots.add(selectedPath);
    return discoverClanFolders(selectedPath);
  });

  ipcMain.handle('clans:open', async (_event, clanPath: string) => {
    const savePath = resolveClanSavePath(clanPath);
    const clanMetadataPath = await findClanMetadataPath(clanPath);
    try {
      const [contents, clanMetadataContents] = await Promise.all([
        fs.readFile(savePath, 'utf8'),
        clanMetadataPath ? fs.readFile(clanMetadataPath, 'utf8') : Promise.resolve(null),
      ]);
      return {
        filePath: savePath,
        fileName: path.basename(savePath),
        contents,
        ...(clanMetadataContents === null || !clanMetadataPath ? {} : {
          companionFile: {
            filePath: clanMetadataPath,
            fileName: path.basename(clanMetadataPath),
            contents: clanMetadataContents,
          },
        }),
      };
    } catch {
      throw new Error(`Could not read clan_cats.json from ${path.basename(clanPath)}.`);
    }
  });

  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'ClanGen save', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    if (path.basename(filePath) === 'clan_cats.json') allowedSavesRoots.add(path.resolve(path.dirname(filePath), '..'));
    return { filePath, fileName: path.basename(filePath), contents: await fs.readFile(filePath, 'utf8') };
  });

  ipcMain.handle('file:write', async (_event, filePath: string, contents: string) => {
    await fs.writeFile(filePath, contents, 'utf8');
  });

  ipcMain.handle('clans:save', async (_event, clanCatsPath: string, cats: unknown) => {
    const savePath = resolveClanCatsPath(clanCatsPath);
    const catsContents = JSON.stringify(cats, null, 2) + '\n';
    const clanFolderPath = path.dirname(savePath);
    const metadataPath = await findClanMetadataPath(clanFolderPath);
    await fs.writeFile(savePath, catsContents, 'utf8');
    try {
      if (!metadataPath) return { metadataFileName: null };
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as Record<string, unknown>;
      metadata.clan_cats = Array.isArray(cats) ? cats.map((cat) => String((cat as Record<string, unknown>).ID)).join(',') : '';
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
      return { metadataFileName: path.basename(metadataPath) };
    } catch {
      return { metadataFileName: null };
    }
  });

  ipcMain.handle('file:choose-save', async (_event, fileName: string, currentPath?: string | null) => {
    const result = await dialog.showSaveDialog({
      defaultPath: currentPath ?? fileName,
      filters: [{ name: 'ClanGen save', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return { filePath: result.filePath, fileName: path.basename(result.filePath) };
  });

  ipcMain.handle('resources:select', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select the ClanGen data folder',
      message: 'Choose the folder containing the game resources.',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const parentPath = path.resolve(result.filePaths[0]);
    const directoryPath = await resolveResourceDirectory(parentPath);
    return { parentPath, directoryPath };
  });

  ipcMain.handle('resources:read-file', async (_event, directoryPath: string, relativePath: string) => {
    try {
      return await fs.readFile(resolveResourcePath(directoryPath, relativePath), 'utf8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('resources:write-file', async (_event, directoryPath: string, relativePath: string, contents: string) => {
    await fs.writeFile(resolveResourcePath(directoryPath, relativePath), contents, 'utf8');
  });

  ipcMain.handle('resources:list-files', async (_event, directoryPath: string, relativePath: string) => {
    try {
      return await listFiles(resolveResourcePath(directoryPath, relativePath));
    } catch {
      return [];
    }
  });

  ipcMain.handle('sprites:read-file', async (_event, directoryPath: string, relativePath: string) => {
    try {
      const buffer = await fs.readFile(resolveSpritePath(directoryPath, relativePath));
      return buffer.toString('base64');
    } catch {
      return null;
    }
  });
}

async function discoverClanFolders(rootPath?: string): Promise<Array<{ name: string; path: string }>> {
  const roots = rootPath ? [path.resolve(rootPath)] : defaultSavesPaths;
  const discovered = new Map<string, { name: string; path: string }>();
  for (const currentRoot of roots) {
    for (const clan of await discoverClanFoldersInRoot(currentRoot)) discovered.set(path.resolve(clan.path), clan);
  }
  return [...discovered.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function discoverClanFoldersInRoot(rootPath: string): Promise<Array<{ name: string; path: string }>> {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const clans: Array<{ name: string; path: string }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const clanPath = path.join(rootPath, entry.name);
      try {
        await fs.access(path.join(clanPath, 'clan_cats.json'));
        clans.push({ name: entry.name, path: clanPath });
      } catch {
        // Ignore folders that are not complete ClanGen save folders.
      }
    }
    return clans;
  } catch {
    return [];
  }
}

async function findClanMetadataPath(clanPath: string): Promise<string | null> {
  const clanFolderPath = path.basename(clanPath) === 'clan_cats.json' ? path.dirname(clanPath) : clanPath;
  const metadataPath = path.join(path.dirname(clanFolderPath), `${path.basename(clanFolderPath)}clan.json`);
  return await fileExists(metadataPath) ? metadataPath : null;
}

async function resolveResourceDirectory(parentPath: string): Promise<string> {
  const candidates = [
    parentPath,
    path.join(parentPath, '_internal', 'resources'),
    path.join(parentPath, 'resources'),
    path.join(parentPath, 'ClanGen', '_internal', 'resources'),
  ];
  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        const namesPath = path.join(candidate, 'dicts', 'names', 'names.json');
        if (await fileExists(namesPath)) return candidate;
      }
    } catch {
      // Try the next supported installation layout.
    }
  }
  throw new Error('The selected folder does not contain a supported game resources folder.');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveClanSavePath(clanPath: string): string {
  const resolvedClanPath = path.resolve(clanPath);
  const isAllowed = [...allowedSavesRoots].some((savesRoot) => {
    const relativeClanPath = path.relative(savesRoot, resolvedClanPath);
    return relativeClanPath && !relativeClanPath.startsWith('..') && !path.isAbsolute(relativeClanPath);
  });
  if (!isAllowed) {
    throw new Error('The selected clan folder is outside the allowed saves folders.');
  }
  return path.join(resolvedClanPath, 'clan_cats.json');
}

function resolveClanCatsPath(clanCatsPath: string): string {
  const resolvedPath = path.resolve(clanCatsPath);
  if (path.basename(resolvedPath) !== 'clan_cats.json') throw new Error('Invalid clan_cats.json path.');
  resolveClanSavePath(path.dirname(resolvedPath));
  return resolvedPath;
}

function resolveResourcePath(directoryPath: string, relativePath: string): string {
  const root = path.resolve(directoryPath);
  const candidate = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resource path escapes the selected directory.');
  return candidate;
}

function resolveSpritePath(resourceDirectoryPath: string, relativePath: string): string {
  const root = path.resolve(path.dirname(path.resolve(resourceDirectoryPath)), 'sprites');
  const candidate = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Sprite path escapes the sprites directory.');
  return candidate;
}

async function listFiles(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(entryPath)).map((file) => path.join(entry.name, file)));
    else if (entry.isFile()) files.push(entry.name);
  }
  return files;
}

app.whenReady().then(() => {
  registerFileHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});