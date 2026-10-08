import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { cleanupLegacyPwaArtifacts } from "./lib/legacyPwaCleanup";
import { RuntimeErrorBoundary } from "./components/debug/RuntimeErrorBoundary";
import { useStore } from "./store";
import {
  restoreLastProjectSnapshot,
  saveLastProjectSnapshot,
  initializeProjectSessions,
} from "./lib/projectSession";

void cleanupLegacyPwaArtifacts();
function populateDefaultCharacters(store: any) {
  store.newProject();
  store.setProjectName("Medieval Characters");

  // 1. Merchant
  store.createEntity("character", "biped_profile_sturdy_v1", "Бородатый Купец");
  const peasantId = store.project.activeEntityId;
  if (peasantId) {
    store.setEntityAppearance(peasantId, { view: "right", sex: "male", muscle: 30, fat: 60, nose: "broad" });
    store.setEntityPaletteToken(peasantId, "skin", "#D8A880");
    store.setEntityPaletteToken(peasantId, "hair", "#4B382A");
    store.setEntityFaceFeature(peasantId, "hair", { presetId: "merchant_dense_curls", visible: true });
    store.setEntityFaceFeature(peasantId, "beard", { presetId: "merchant_full_beard", visible: true });
    store.setEntityFaceFeature(peasantId, "eyes", { presetId: "iris_round", visible: true });
    store.setEntityFaceFeature(peasantId, "mouth", { presetId: "neutral", visible: true });
    store.setEntitySlot(peasantId, "slot_torso", "merchant_quilted_vest_25d");
    store.setEntitySlot(peasantId, "slot_legs", "trader_breeches_25d");
    store.setEntitySlot(peasantId, "slot_foot_l", "trader_boots_25d");
    store.setEntitySlot(peasantId, "slot_weapon_main", "peasant_axe_25d");
  }

  // 2. Warrior
  store.createEntity("character", "biped_profile_base_v1", "Молодой Мечник");
  const warriorId = store.project.activeEntityId;
  if (warriorId) {
    store.setEntityAppearance(warriorId, { view: "right", sex: "male", muscle: 90, slimness: 0, scar: "eye", nose: "straight" });
    store.setEntityPaletteToken(warriorId, "skin", "#E8AF88");
    store.setEntityPaletteToken(warriorId, "hair", "#5C3928");
    store.setEntityFaceFeature(warriorId, "hair", { presetId: "warrior_spiky_manga", visible: true });
    store.setEntityFaceFeature(warriorId, "beard", { presetId: "warrior_stubble", visible: true });
    store.setEntityFaceFeature(warriorId, "eyes", { presetId: "dot_cute", visible: true });
    store.setEntityFaceFeature(warriorId, "mouth", { presetId: "smirk", visible: true });
    store.setEntitySlot(warriorId, "slot_torso", "warrior_laced_undershirt_25d");
    store.setEntitySlot(warriorId, "slot_legs", "peasant_trousers_25d");
    store.setEntitySlot(warriorId, "slot_foot_l", "warrior_footwraps_25d");
    store.setEntitySlot(warriorId, "slot_weapon_main", "iron_sword_25d");
  }

  if (peasantId) {
    store.setActiveEntity(peasantId);
  }
  saveLastProjectSnapshot(store.project);
}

async function boot() {
  await initializeProjectSessions();
  const lastProject = restoreLastProjectSnapshot();
  const store = useStore.getState();
  if (lastProject && (lastProject as any).entities && (lastProject as any).entities.length > 0) {
    store.loadProject(lastProject);
    if (!store.project.activeEntityId && store.project.entities.length > 0) {
      store.setActiveEntity(store.project.entities[0].id);
    }
  } else {
    populateDefaultCharacters(store);
  }
  useStore.getState().setPlaybackPlaying(false);
  (window as any).__STORE__ = useStore;
  createRoot(document.getElementById("root")!).render(
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>,
  );
}

void boot();
