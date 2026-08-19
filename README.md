# ClanGen Save Editor

Local Electron desktop app for editing ClanGen `clan_cats.json` files.

## Requirements

- Windows
- Node.js 20 or newer

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

The app uses Electron's native Windows file dialogs. Choose a saves folder with **Open**, choose a game data folder with **ClanGen Data**, and use **Save** to write the edited JSON to a selected path.

At startup, the app scans common ClanGen and LifeGen save locations. The **Clan save** selector lists immediate subfolders containing `clan_cats.json`; selecting one opens that file directly. You can also choose any other saves folder with **Open**.

Use **ClanGen Data** to select either a game installation folder or its resources folder. The app recognizes `_internal\resources`, `resources`, and directly selected resource directories. Resource catalogs use the standard `dicts`, `lang`, and sprite folders when present.

Both standard ClanGen and LifeGen saves use the shared `clan_cats.json` editor. LifeGen companion files such as `{clanName}clan.json` are read and updated when present; ClanGen saves without a companion file are saved without creating one.

The automatic Windows save locations include:

- `%LOCALAPPDATA%\LifeGen\LifeGen\saves`
- `%LOCALAPPDATA%\ClanGen\ClanGen\saves`
- `%LOCALAPPDATA%\ClanGen\saves`
- `%APPDATA%\ClanGen\saves`

Filesystem access is implemented by the Electron main process and exposed to the renderer through a typed preload bridge. The renderer does not receive unrestricted Node.js access.

## Portable build

```powershell
npm.cmd run package:portable
```

The portable executable is written to the `dist` directory by electron-builder.

## Project layout

- `src/` - React renderer, editor model, store, and resource catalog
- `electron/main.ts` - native window, dialog, and filesystem operations
- `electron/preload.ts` - typed renderer bridge
- `dist-electron/` - compiled Electron process files

This project is Electron-only. The original browser/GitHub Pages project remains separate.