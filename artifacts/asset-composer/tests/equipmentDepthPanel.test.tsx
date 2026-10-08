// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect,it } from "vitest";
import { EquipmentDepthPanel } from "../src/components/panels/EquipmentDepthPanel";
import { useStore } from "../src/store";
import { studioCommit } from "../src/lib/studioActions";
import { animController } from "../src/core-v2/AnimationController";
import { ProjectSchema } from "../src/domain/schema";

it("saves near/far item setup for all clips in one undo step without editing the clip or pose",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  useStore.getState().newProject();useStore.getState().createEntity("character","biped_profile_base_v1","Setup test");
  const item=structuredClone(useStore.getState().project.items.find(i=>i.category==="weapon_main"&&i.parts?.length)!);
  studioCommit("Test item",p=>{
    item.id="custom_setup_sword";item.parts![0].boneId="hand_r";item.parts![0].depthBinding=undefined;
    p.items.push(item);p.entities[0].slots.find(s=>s.slotId==="side_slot_weapon_main")!.itemId=item.id;
  });
  useStore.getState().setPlaybackClip("chibi_front__walk");useStore.getState().setPlaybackPlaying(false);useStore.getState().setPlaybackTime(250);
  const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(<EquipmentDepthPanel/>));
    const before=useStore.getState(),clips=structuredClone(before.project.animationClips),pose=structuredClone(before.project.entities[0].poseOverrides),count=before.history.past.length;
    const button=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Сохранить слои предмета")!;
    expect(button).toBeDefined();await act(async()=>button.click());
    const part=()=>useStore.getState().project.items.find(i=>i.id==="custom_setup_sword")!.parts![0];
    expect(part().depthBinding).toEqual({boneId:"hand_r",nearSlot:"EQUIPMENT_FRONT",farSlot:"BODY_BACK"});
    expect(part().occludedByBones).toEqual(["hand_l","hand_r"]);
    expect(useStore.getState().history.past).toHaveLength(count+1);
    expect(useStore.getState().project.animationClips).toEqual(clips);
    expect(useStore.getState().project.entities[0].poseOverrides).toEqual(pose);
    expect(useStore.getState().animPlayback.timeMs).toBe(250);
    expect(ProjectSchema.parse(JSON.parse(JSON.stringify(useStore.getState().project))).items.find(i=>i.id==="custom_setup_sword")!.parts![0].depthBinding).toEqual(part().depthBinding);
    await act(async()=>useStore.getState().undo());expect(part().depthBinding).toBeUndefined();
    await act(async()=>useStore.getState().redo());expect(part().depthBinding?.nearSlot).toBe("EQUIPMENT_FRONT");
  } finally {await act(async()=>root.unmount());host.remove();animController.pause();}
});
