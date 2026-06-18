"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("assetComposerProjects", {
  pickProjectFolder: () => ipcRenderer.invoke("asset-composer:pick-project-folder"),
  readProjectFromFolder: folderPath => ipcRenderer.invoke("asset-composer:read-project-from-folder", folderPath),
  saveProjectToFolder: (folderPath, project) => ipcRenderer.invoke("asset-composer:save-project-to-folder", folderPath, project),
});
