export interface DesktopFileReference {
  filePath: string;
  fileName: string;
}

export interface OpenedFileReference extends DesktopFileReference {
  contents: string;
  companionFile?: OpenedFileReference;
}

export async function showOpenFilePicker(): Promise<OpenedFileReference | null> {
  return window.electronFileSystem.openFile();
}

export async function showSaveFilePicker(fileName: string, currentPath?: string | null): Promise<DesktopFileReference | null> {
  return window.electronFileSystem.chooseSaveFile(fileName, currentPath);
}

export async function showDirectoryPicker(): Promise<string | null> {
  return (await window.electronFileSystem.selectResourceDirectory())?.directoryPath ?? null;
}

export async function readJsonFile(fileReference: { contents: string }): Promise<unknown> {
  try {
    return JSON.parse(fileReference.contents);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The selected file is not valid JSON.');
    }
    throw error;
  }
}

export async function writeJsonFile(fileReference: DesktopFileReference, value: unknown): Promise<void> {
  await window.electronFileSystem.writeFile(fileReference.filePath, JSON.stringify(value, null, 2) + '\n');
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await window.electronFileSystem.writeClipboardText(text);
}

export async function readTextFromClipboard(): Promise<string> {
  return window.electronFileSystem.readClipboardText();
}
