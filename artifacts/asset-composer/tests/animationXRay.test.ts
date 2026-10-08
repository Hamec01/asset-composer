// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { evaluateExportScene, composeFrameSvg, exportCamera } from "../src/lib/exportFrames";
import { ANATOMY_COLORS, DEFAULT_XRAY_OPTIONS, anatomyColor, evaluatePresentedScene, presentAnimationXRay,
  shadeForDepth, silhouetteSvg, shoulderRoots, xrayOverlaySvg } from "../src/lib/animationXRay";
import { animationReviewArchive, buildAnimationReview, reviewMarkersFor, validateReviewMarkers } from "../src/lib/animationReview";
import { ProjectSchema } from "../src/domain/schema";
import { createEditableBodyPart } from "../src/lib/bodyPartAuthoring";
import { twoHandedSwordStrike, upgradeTwoHandedSwordClip } from "../src/data/twoHandedSwordAnimation";
import { animController } from "../src/core-v2/AnimationController";
import { DEPTH_COLORS } from "../src/lib/limbDepth";
import { strFromU8, unzipSync } from "fflate";

afterEach(() => { animController.pause(); useStore.getState().setAnimationXRay(DEFAULT_XRAY_OPTIONS); });

function fixture(view: "right" | "left" = "right", name = "two_handed_sword_strike") {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "X-Ray review");
  const project = useStore.getState().project;
  const entity = structuredClone(project.entities[0]);
  entity.appearance = { ...entity.appearance!, view };
  const template = resolveTemplate(project, entity.templateId)!;
  const clip = project.animationClips.find(c => c.name === name)!;
  const input = { entity, template, clips: project.animationClips, clip, items: project.items, fitProfiles: project.itemFitProfiles };
  const scene = (timeMs = 600) => evaluateExportScene(entity, template, input.clips, input.items, input.fitProfiles,
    { key: "test", clip, frame: timeMs * clip.fps / 1000, timeMs });
  return { ...input, project, scene };
}

describe("Animation X-Ray presentation", () => {
  it("keeps colors anatomical across projections and shades segments independently", () => {
    for (const view of ["right", "left"] as const) {
      const f = fixture(view), original = f.scene();
      const rig = presentAnimationXRay(original, f.items, { ...DEFAULT_XRAY_OPTIONS, mode: "rig" }, view);
      for (const v of rig.visuals) {
        expect(v.svgData).toContain(`flood-color="${shadeForDepth(anatomyColor(v.boneId)!, v.renderDepth?.slot)}"`);
      }
      const far = view === "right" ? "r" : "l";
      const upper = rig.visuals.find(v => v.boneId === `shoulder_${far}`)!;
      const forearm = rig.visuals.find(v => v.boneId === `elbow_${far}`)!;
      expect(upper.renderDepth!.slot).toBe("FAR_LIMB");
      expect(forearm.renderDepth!.slot).toBe("CROSS_BODY");
      expect(upper.svgData).toContain(`flood-color="${shadeForDepth(anatomyColor(upper.boneId)!, "FAR_LIMB")}"`);
      expect(forearm.svgData).toContain(`flood-color="${anatomyColor(forearm.boneId)}"`);
      expect(anatomyColor("shoulder_l")).toBe(ANATOMY_COLORS.leftArm);
      expect(anatomyColor("shoulder_r")).toBe(ANATOMY_COLORS.rightArm);
      expect(anatomyColor("hip_l")).toBe(ANATOMY_COLORS.leftLeg);
      expect(anatomyColor("hip_r")).toBe(ANATOMY_COLORS.rightLeg);
    }
  });

  it("preserves the source SVG geometry, alpha holes, gradients and clip paths", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -4 40 50"><defs><linearGradient id="g"><stop stop-color="pink"/></linearGradient><clipPath id="c"><circle r="4"/></clipPath></defs><path style="fill:url(#g)" fill-rule="evenodd" clip-path="url(#c)" d="M0 0h30v30H0z M5 5v10h10V5z"/></svg>';
    const painted = silhouetteSvg(source, ANATOMY_COLORS.leftArm);
    expect(painted).toContain('viewBox="-3 -4 40 50"');
    expect(painted).toContain(source.slice(source.indexOf("<defs>"), source.lastIndexOf("</svg>")));
    expect(painted).toContain('in2="SourceAlpha" operator="in"');
  });

  it("restores actual body beneath clothes without changing the equipped pose or project", () => {
    const f = fixture("right", "bow_shoot");
    f.entity.slots.find(s => s.slotId === "side_slot_torso")!.itemId = "trader_tunic_25d";
    f.entity.slots.find(s => s.slotId === "side_slot_weapon_main")!.itemId = "bow_25d";
    const snapshot = JSON.stringify(f.entity), normal = f.scene(1280);
    expect(normal.visuals.some(v => v.boneId === "chest" && v.anatomicalBody)).toBe(false);
    const rig = evaluatePresentedScene(f.entity, f.template, normal.skeleton, f.items, f.fitProfiles, { ...DEFAULT_XRAY_OPTIONS, mode: "rig" });
    expect(rig.presentation!.supported).toBe(true);
    expect(rig.visuals.some(v => v.boneId === "chest" && v.anatomicalBody)).toBe(true);
    expect(rig.visuals.every(v => v.anatomicalBody)).toBe(true);
    expect(rig.skeleton).toBe(normal.skeleton);
    expect(JSON.stringify(f.entity)).toBe(snapshot);
    expect(f.scene(1280)).toEqual(normal);
    const equipped = evaluatePresentedScene(f.entity, f.template, normal.skeleton, f.items, f.fitProfiles,
      { ...DEFAULT_XRAY_OPTIONS, mode: "rig", showEquipment: true });
    const bow = equipped.visuals.find(v => v.itemId === "bow_25d" && v.partId === "bow")!;
    expect(bow.svgData).toBe(normal.visuals.find(v => v.id === bow.id)!.svgData);
    expect(equipped.visuals.some(v => v.itemId === "trader_tunic_25d")).toBe(false);
  });

  it("recognizes a user replacement and uses its actual bone instead of the template drawing", () => {
    const f = fixture();
    const part = f.template.boneParts!.find(p => p.boneId === "shoulder_r")!;
    const custom = { ...createEditableBodyPart(part), bodyView: "side" as const };
    f.entity.visuals = [custom];
    const normal = f.scene();
    const replacement = normal.visuals.find(v => v.entityVisualId === custom.id)!;
    expect(replacement.boneId).toBe("shoulder_r");
    expect(replacement.anatomicalBody).toBe(true);
    expect(replacement.renderDepth!.slot).toBe("FAR_LIMB");
    const rig = presentAnimationXRay(normal, f.items, { ...DEFAULT_XRAY_OPTIONS, mode: "rig" });
    expect(rig.visuals.some(v => v.id === `part__${part.id}`)).toBe(false);
    expect(rig.visuals.find(v => v.id === replacement.id)!.worldMatrix).toEqual(replacement.worldMatrix);
  });

  it("changes only presentation and retains actual depth order and geometry", () => {
    const f = fixture(), normal = f.scene(), saved = JSON.stringify(normal.visuals);
    const rig = presentAnimationXRay(normal, f.items, { ...DEFAULT_XRAY_OPTIONS, mode: "rig" });
    const depth = presentAnimationXRay(normal, f.items, { ...DEFAULT_XRAY_OPTIONS, mode: "depth" });
    for (const scene of [rig, depth]) {
      expect(scene.skeleton).toBe(normal.skeleton);
      for (const v of scene.visuals) {
        const source = normal.visuals.find(s => s.id === v.id)!;
        expect([v.worldMatrix, v.localBounds, v.worldBounds, v.zIndex, v.renderDepth])
          .toEqual([source.worldMatrix, source.localBounds, source.worldBounds, source.zIndex, source.renderDepth]);
      }
    }
    for (const v of depth.visuals) expect(v.svgData).toContain(`flood-color="${DEPTH_COLORS[v.renderDepth!.slot]}"`);
    expect(JSON.stringify(normal.visuals)).toBe(saved);
    expect(presentAnimationXRay(normal, f.items, DEFAULT_XRAY_OPTIONS)).toBe(normal);
    const flat = presentAnimationXRay(normal, f.items, { ...DEFAULT_XRAY_OPTIONS, mode: "rig", depthShading: false });
    for (const v of flat.visuals) expect(v.svgData).toContain(`flood-color="${anatomyColor(v.boneId)}"`);
  });

  it("draws both arms and legs, shoulder roles and shared export annotations", () => {
    const f = fixture("left"), normal = f.scene();
    const scene = presentAnimationXRay(normal, f.items, { ...DEFAULT_XRAY_OPTIONS, mode: "skeleton" }, "left");
    const overlay = xrayOverlaySvg(scene, 2);
    expect(overlay).toContain("SL · F"); expect(overlay).toContain("SR · N");
    expect(overlay).toContain("knee_l"); expect(overlay).toContain("foot_r");
    expect(overlay.match(/<polyline/g)).toHaveLength(5);
    expect(composeFrameSvg(scene, exportCamera([scene]), 320)).toContain("SL · F");
    expect(shoulderRoots(scene).distance).toBeGreaterThan(0);
  });

  it("reports monolithic artwork as unsupported without fake anatomy", () => {
    const f = fixture(), normal = f.scene();
    const monolithic = { ...normal, visuals: [{ ...normal.visuals[0], anatomicalBody: false, boneId: "root", sourceKind: "base-layer" as const }] };
    const rig = presentAnimationXRay(monolithic, f.items, { ...DEFAULT_XRAY_OPTIONS, mode: "rig" });
    expect(rig.presentation!.supported).toBe(false);
    expect(rig.visuals).toBe(monolithic.visuals);
    expect(xrayOverlaySvg(rig)).toBe("");
  });
});

describe("Animation review", () => {
  it("evaluates the supplied clip even when the project's copy has older motion", () => {
    const f = fixture(), clip = structuredClone(f.clip);
    clip.gripObjects![0].keyframes[0].x -= 4;
    const review = buildAnimationReview({ ...f, clip, markers: [{ label: "Edited guard", timeMs: 0 }] });
    expect(review.report.samples[0].joints.hand_l).not.toEqual(f.scene(0).skeleton.bones.get("hand_l"));
    expect(f.clips.find(candidate => candidate.id === clip.id)!.gripObjects![0].keyframes[0].x).toBe(18);
  });

  it("exports both directions, exact Recover, one camera and actual ordered metadata", async () => {
    const f = fixture(), review = buildAnimationReview(f);
    expect(review.sheets.map(s => s.facing)).toEqual(["right", "left"]);
    expect(review.report.samples).toHaveLength(12);
    expect(review.report.markers.at(-1)).toEqual({ label: "Recover", timeMs: 1600 });
    for (const sheet of review.sheets) {
      const camera = review.report.camera;
      expect(sheet.svg.match(new RegExp(`viewBox="${camera.x} ${camera.y} ${camera.size} ${camera.size}"`, "g"))).toHaveLength(24);
      expect(sheet.svg).toContain("RIG COLORS"); expect(sheet.svg).toContain("DEPTH COLORS");
    }
    const sample = review.report.samples[2];
    expect(sample.joints).toEqual(Object.fromEntries(f.scene(600).skeleton.bones));
    expect(sample.shoulders.distance).toBeCloseTo(shoulderRoots(f.scene(600)).distance!);
    expect(sample.anatomyVisuals.find(v => v.boneId === "shoulder_r")!.depth!.slot).toBe("FAR_LIMB");
    const archive = await animationReviewArchive(review, async () => new Uint8Array([137, 80, 78, 71]));
    const files = unzipSync(archive);
    expect(Object.keys(files).sort()).toEqual(["review-left.png", "review-left.svg", "review-right.png", "review-right.svg", "review.json"]);
    expect(JSON.parse(strFromU8(files["review.json"])).samples).toHaveLength(12);
  });

  it("uses honest uniform samples for old clips and validates marker times and labels", () => {
    const clip = { ...twoHandedSwordStrike, reviewMarkers: undefined };
    expect(reviewMarkersFor(clip).map(m => m.timeMs)).toEqual([0, 320, 640, 960, 1280, 1600]);
    expect(reviewMarkersFor(clip).every(m => m.label.endsWith(" ms"))).toBe(true);
    for (const markers of [[], [{ label: "", timeMs: 0 }], [{ label: "Pose", timeMs: NaN }], [{ label: "Pose", timeMs: 1601 }]]) {
      expect(validateReviewMarkers(markers, 1600)).not.toBeNull();
    }
    expect(validateReviewMarkers([{ label: "Recover", timeMs: 1600 }], 1600)).toBeNull();
    const escaped = buildAnimationReview({ ...fixture(), markers: [{ label: '<pose & "test">', timeMs: 0 }] });
    expect(escaped.sheets[0].svg).toContain("&lt;pose &amp; &quot;test&quot;&gt;");
  });

  it("roundtrips optional markers, preserves authored markers and stores settings outside project/history", () => {
    const f = fixture(), state = useStore.getState(), snapshot = JSON.stringify(state.project), past = state.history.past.length;
    state.setAnimationXRay({ mode: "rig", showEquipment: true });
    expect(JSON.stringify(useStore.getState().project)).toBe(snapshot);
    expect(useStore.getState().history.past).toHaveLength(past);
    state.setAnimationReviewMarkers(f.clip.id, [{ label: "My pose", timeMs: 600 }]);
    const saved = useStore.getState().project.animationClips.find(c => c.id === f.clip.id)!;
    expect(ProjectSchema.shape.animationClips.element.parse(JSON.parse(JSON.stringify(saved))).reviewMarkers).toEqual(saved.reviewMarkers);
    expect(upgradeTwoHandedSwordClip(saved).reviewMarkers).toEqual(saved.reviewMarkers);
    useStore.getState().undo();
    expect(useStore.getState().project.animationClips.find(c => c.id === f.clip.id)!.reviewMarkers).toEqual(f.clip.reviewMarkers);
    useStore.getState().redo();
    expect(useStore.getState().project.animationClips.find(c => c.id === f.clip.id)!.reviewMarkers).toEqual([{ label: "My pose", timeMs: 600 }]);
    const old = { ...f.clip }; delete old.reviewMarkers;
    expect(ProjectSchema.shape.animationClips.element.parse(old).reviewMarkers).toBeUndefined();
  });
});
