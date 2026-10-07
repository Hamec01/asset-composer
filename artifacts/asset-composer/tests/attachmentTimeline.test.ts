// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { animController } from "../src/core-v2/AnimationController";
import type { AnimationClip, BonePart } from "../src/domain/types";
import { boneAttachmentAt } from "../src/lib/animationContext";
import { getCharacterBodyParts } from "../src/data/chibiBody";
import { transformPoint,worldBoneToMatrix } from "../src/lib/matrixUtils";
import { ProjectSchema } from "../src/domain/schema";

describe("attachment timeline and bone inheritance", () => {
  it("keeps the arrow separate from the bow and swaps distinct drawing-hand grips", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Archer");
    const project = useStore.getState().project;
    const entity = structuredClone(project.entities[0]);
    const template = resolveTemplate(project, entity.templateId)!;
    entity.slots.find(s => s.slotId === "side_slot_weapon_main")!.itemId = "bow_25d";
    const clip = CHIBI_ANIMATIONS.find(c => c.name === "bow_shoot")!;
    const scene = (fraction: number) => evaluateScene(entity, template,
      evaluateSkeleton(template.bones, resolveClipPose(clip, fraction*clip.durationMs), undefined, entity.appearance), project.items);
    const atDraw = scene(.64);
    for (const id of ["bow", "bow_string"]) {
      expect(atDraw.visuals.some(v => v.partId === id)).toBe(true);
    }
    const bow = project.items.find(item => item.id === "bow_25d")!.parts!.find(part => part.id === "bow")!;
    expect(bow.metrics.viewBoxHeight).toBeGreaterThanOrEqual(80);
    for (const fraction of [0, .2, .64, .73, 1]) {
      expect(scene(fraction).visuals.some(v => v.partId === "nocked_arrow")).toBe(false);
    }
    const hand = (fraction: number, id: string) => scene(fraction).visuals.find(v => v.sourceKind === "bone-part" && v.boneId === id)!;
    const hook = hand(.64, "hand_r");
    const release = hand(.73, "hand_r");
    const grip = hand(.64, "hand_l");
    expect(new Set([hook.svgData, release.svgData, grip.svgData]).size).toBe(3);
    expect(hook.localBounds).toEqual(release.localBounds);
    animController.pause();
  });
  it("resolves replacement frames and sockets together without mutating the setup attachment",()=>{
    const part:BonePart={id:"hand",boneId:"hand_r",svgData:'<svg viewBox="-5 -2 10 12"/>',naturalWidth:10,naturalHeight:12,localX:0,localY:4,zOffset:0,
      grip:{x:0,y:4},attachments:{hook:'<svg viewBox="-2 -7 14 14"/>'},attachmentGrips:{hook:{x:5,y:0}}};
    const clip={id:"custom",durationMs:1000,loops:false,layers:[],attachments:[{boneId:"hand_r",keyframes:[{timeMs:0,name:"hook"}]}]} as unknown as AnimationClip;
    const result=boneAttachmentAt(part,{clip,timeMs:0});
    expect(result).toMatchObject({localX:5,localY:0,naturalWidth:14,naturalHeight:14,gripSocket:{x:5,y:0}});
    expect(part).toMatchObject({localX:0,localY:4,grip:{x:0,y:4}});
  });
  it("uses the active palm socket for the bow and string in both mirrored views",()=>{
    useStore.getState().newProject();
    useStore.getState().createEntity("character","biped_profile_base_v1","Grip audit");
    const project=useStore.getState().project,entity=structuredClone(project.entities[0]);
    entity.slots.find(s=>s.slotId==="side_slot_weapon_main")!.itemId="bow_25d";
    const template=resolveTemplate(project,entity.templateId)!,clip=CHIBI_ANIMATIONS.find(c=>c.name==="bow_shoot")!;
    for(const view of ["left","right"] as const) {
      entity.appearance={...entity.appearance!,view};
      const timeMs=clip.durationMs*.64,context={clip,timeMs};
      const skeleton=evaluateSkeleton(template.bones,resolveClipPose(clip,timeMs),undefined,entity.appearance);
      const parts=getCharacterBodyParts(template,entity).map(part=>boneAttachmentAt(part,context));
      const hand=parts.find(p=>p.boneId==="hand_r")!,socket=hand.gripSocket!;
      expect(socket.y).toBe(0);
      expect(ProjectSchema.shape.templates.element.parse({...template,boneParts:parts}).boneParts!.find(p=>p.boneId==="hand_r")!.attachmentGrips).toEqual(hand.attachmentGrips);
      const palm=transformPoint(worldBoneToMatrix(skeleton.bones.get("hand_r")!),socket.x,socket.y);
      const scene=evaluateScene(entity,template,skeleton,project.items);
      const string=scene.visuals.find(v=>v.partId==="bow_string")!;
      const data=string.svgData.match(/id="bow-string" d="[^"]*L([^ ]+) ([^ ]+) L/)!;
      const itemPart=project.items.find(i=>i.id==="bow_25d")!.parts!.find(p=>p.id==="bow_string")!;
      const actual=transformPoint(string.worldMatrix,+data[1]+itemPart.metrics.viewBoxX,+data[2]+itemPart.metrics.viewBoxY);
      expect(actual.x).toBeCloseTo(palm.x,6);expect(actual.y).toBeCloseTo(palm.y,6);
      expect(scene.visuals.some(v=>v.partId==="nocked_arrow")).toBe(false);
      // The entire drawing forearm centreline is outside the head's bounding silhouette.
      const head=scene.visuals.find(v=>v.boneId==="head")!;
      const elbow=skeleton.bones.get("elbow_r")!,wrist=skeleton.bones.get("hand_r")!;
      expect(Math.min(elbow.y,wrist.y)-3.5).toBeGreaterThan(head.worldBounds.maxY);
    }
    animController.pause();
  });
  it("removes the old baked arrow when loading an unedited built-in bow",()=>{
    useStore.getState().newProject();
    const saved=structuredClone(useStore.getState().project);
    const bow=saved.items.find(i=>i.id==="bow_25d")!;
    bow.parts!.push({...structuredClone(bow.parts![0]),id:"nocked_arrow"});
    useStore.getState().loadProject(saved);
    expect(useStore.getState().project.items.find(i=>i.id==="bow_25d")!.parts!.map(p=>p.id)).toEqual(["bow","bow_string"]);
  });
  it("are driven by clip data, not by the built-in clip ID", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Archer");
    const project = useStore.getState().project;
    const entity = structuredClone(project.entities[0]);
    const template = resolveTemplate(project, entity.templateId)!;
    entity.slots.find(s => s.slotId === "side_slot_torso")!.itemId = "trader_tunic_25d";
    entity.slots.find(s => s.slotId === "side_slot_weapon_main")!.itemId = "bow_25d";
    const builtIn = CHIBI_ANIMATIONS.find(c => c.name === "bow_shoot")!;
    const copy: AnimationClip = { ...structuredClone(builtIn), id: "user_archery_copy" };

    const scene = (clip: AnimationClip, fraction: number) => {
      entity.activeAnimationClipId = clip.id;
      const pose = resolveClipPose(clip, clip.durationMs * fraction);
      return evaluateScene(entity, template, evaluateSkeleton(template.bones, pose, undefined, entity.appearance), project.items);
    };
    const hand = (clip: AnimationClip, fraction: number) =>
      scene(clip, fraction).visuals.find(v => v.sourceKind === "bone-part" && v.boneId === "hand_l")!;

    const openHand = hand(builtIn, 0).svgData;
    expect(hand(builtIn, .5).svgData).toBe(openHand);
    expect(hand(copy, .5).svgData).toBe(hand(builtIn, .5).svgData);
    expect(hand(copy, 1).svgData).toBe(openHand);

    // Sleeves follow the stretched arm without the renderer correcting their width.
    const sleeve = (clip: AnimationClip) => scene(clip, .5).visuals.find(v => v.partId === "sleeve_upper_l")!.worldMatrix;
    expect(sleeve(copy)).toEqual(sleeve(builtIn));
    expect(Math.hypot(sleeve(copy)[0], sleeve(copy)[1])).toBeLessThan(1.2);
    animController.pause();
  });
});
