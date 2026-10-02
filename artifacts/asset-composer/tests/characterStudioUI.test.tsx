// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { Dashboard } from "../src/pages/Dashboard";
import { NewEntityWizard } from "../src/components/wizard/NewEntityWizard";
import { CharacterPartsPanel } from "../src/components/panels/CharacterPartsPanel";
import { animController } from "../src/core-v2/AnimationController";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => animController.pause());

describe("character studio workflow", () => {
  it("opens a new project and creates a blank starter through the body picker", async () => {
    useStore.getState().setAppState("dashboard");
    function Workflow() {
      const appState = useStore(state => state.editor.appState);
      return appState === "dashboard" ? <Dashboard /> : <><NewEntityWizard /><CharacterPartsPanel /></>;
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(<Workflow />));
      await act(async () => (host.querySelector('[data-testid="dashboard-new"]') as HTMLButtonElement).click());
      expect(useStore.getState().editor.appState).toBe("ide");
      expect(document.body.textContent).toContain("Телосложение");
      await act(async () => (document.querySelector('[data-testid="wizard-template-biped_profile_base_v1"]') as HTMLButtonElement).click());
      await act(async () => (document.querySelector('[data-testid="wizard-create-btn"]') as HTMLButtonElement).click());
      expect(useStore.getState().project.entities).toHaveLength(1);
      expect(host.textContent).toContain("Правая стопа");
      await act(async () => (host.querySelector('[data-testid="edit-body-part-hero_foot_r"]') as HTMLButtonElement).click());
      const project = useStore.getState().project;
      const documentId = project.editorMeta.activeSpriteDocumentId;
      expect(project.editorMeta.activeAuthoringMode).toBe("sprite-editor");
      const visual = project.entities[0].visuals![0];
      expect(visual.boneId).toBe("foot_r");
      expect(visual.bodyPartId).toBe("hero_foot_r");
      expect(visual.editorDocumentId).toBe(documentId);
      await act(async () => (host.querySelector('[data-testid="edit-body-part-hero_foot_r"]') as HTMLButtonElement).click());
      expect(useStore.getState().project.entities[0].visuals).toHaveLength(1);
      expect(useStore.getState().project.editorMeta.activeSpriteDocumentId).toBe(documentId);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
