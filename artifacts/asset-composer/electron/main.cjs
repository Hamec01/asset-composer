"use strict";

const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width:     1400,
    height:    900,
    minWidth:  900,
    minHeight: 600,
    title:     "Asset Composer",
    backgroundColor: "#0f0f11",
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      webSecurity:      false,
      preload:          path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    const port = process.env.PORT || 18579;
    win.loadURL(`http://localhost:${port}/`);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "public", "index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) win.webContents.openDevTools({ mode: "detach" });
}

function buildMenu() {
  const template = [
    {
      label: "Asset Composer",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ type: "separator" }, { role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "close" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getProjectJsonPath(folderPath) {
  return path.join(folderPath, "project.json");
}

ipcMain.handle("asset-composer:pick-project-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose a project folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return { folderPath: result.filePaths[0] };
});

ipcMain.handle("asset-composer:read-project-from-folder", async (_event, folderPath) => {
  if (typeof folderPath !== "string" || folderPath.trim().length === 0) return null;
  try {
    const projectPath = getProjectJsonPath(folderPath);
    const raw = await fs.readFile(projectPath, "utf8");
    return { folderPath, project: JSON.parse(raw) };
  } catch {
    return null;
  }
});

ipcMain.handle("asset-composer:save-project-to-folder", async (_event, folderPath, project) => {
  if (typeof folderPath !== "string" || folderPath.trim().length === 0) return false;
  try {
    await fs.mkdir(folderPath, { recursive: true });
    const projectPath = getProjectJsonPath(folderPath);
    await fs.writeFile(projectPath, JSON.stringify(project, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
