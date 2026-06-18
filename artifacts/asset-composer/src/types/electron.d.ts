export {};

declare global {
  interface Window {
    assetComposerProjects?: {
      pickProjectFolder: () => Promise<{ folderPath: string } | null>;
      readProjectFromFolder: (folderPath: string) => Promise<{ folderPath: string; project: unknown } | null>;
      saveProjectToFolder: (folderPath: string, project: unknown) => Promise<boolean>;
    };
  }
}
