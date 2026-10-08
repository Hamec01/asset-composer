// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { twoHandedSwordStrike as clip, TWO_HANDED_PHASES, upgradeTwoHandedSwordClip } from "../src/data/twoHandedSwordAnimation";
import { bipedProfileChibiBones } from "../src/data/chibiRig";
import { DEFAULT_APPEARANCE } from "../src/data/characterAppearance";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { virtualGripTarget } from "../src/lib/ikConstraint";
import { resolveArmRoles } from "../src/lib/limbDepth";
import { ProjectSchema } from "../src/domain/schema";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { transformPoint, worldBoneToMatrix } from "../src/lib/matrixUtils";
import { angleDelta } from "../src/lib/angles";
import { twoHandedSwordStrike as originalClip } from "./fixtures/originalTwoHandedSword";
import { DEPTH_COLORS } from "../src/lib/limbDepth";

const skeleton = (time: number, view: "right" | "left") => evaluateSkeleton(bipedProfileChibiBones,
  resolveClipPose(clip, time), undefined, { ...DEFAULT_APPEARANCE, view });

describe("two-handed strike", () => {
  it("upgrades saved built-in timing without overwriting authored motion", () => {
    const old = structuredClone(originalClip);
    const parsed=ProjectSchema.shape.animationClips.element.parse(old);
    expect(upgradeTwoHandedSwordClip(parsed).gripObjects).toEqual(clip.gripObjects);
    expect(upgradeTwoHandedSwordClip(parsed).layers).toEqual(clip.layers);
    expect(upgradeTwoHandedSwordClip(parsed).limbDepth).toEqual(clip.limbDepth);
    for(const elbowX of [28,29]) {
      const timing=structuredClone(originalClip);
      for(const k of timing.gripObjects![0].keyframes) {
        if(k.timeMs===280 || k.timeMs===1440)k.easing="ease_out";
        if(k.timeMs===600){k.y=-68;k.easing="ease_in";}
        if(k.timeMs===940)k.x=elbowX;
        if(k.timeMs===1060)k.easing="smooth";
      }
      expect(upgradeTwoHandedSwordClip(timing).gripObjects).toEqual(clip.gripObjects);
    }
    const intentional=structuredClone(parsed);
    intentional.headOverlap=[{startMs:0,endMs:200,bones:["hand_l"],reason:"Authored gesture"}];
    expect(upgradeTwoHandedSwordClip(intentional)).toBe(intentional);
    parsed.gripObjects![0].keyframes[1].x+=1;
    expect(upgradeTwoHandedSwordClip(parsed)).toBe(parsed);
  });
  it("slows into the apex, accelerates into the strike and preserves rigid sockets", () => {
    const target = { objectId: "two_hand_handle", socketId: "bladeHand" };
    const center = (time: number) => {
      const a = virtualGripTarget(clip, target, time)!;
      const b = virtualGripTarget(clip, {...target,socketId:"pommelHand"}, time)!;
      expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeCloseTo(15, 8);
      return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    };
    const speed = (a: number,b: number) => {
      const p=center(a),q=center(b);
      return Math.hypot(p.x-q.x,p.y-q.y)/(b-a);
    };
    expect(speed(580,600)).toBeLessThan(speed(280,300));
    expect(speed(600,620)).toBeLessThan(speed(740,760));
    expect(speed(1580,1600)).toBeLessThan(speed(1440,1460));
  });
  it("does not snap wrists or flip elbows on frame and half-frame sampling", () => {
    for (const view of ["right","left"] as const) {
      let previous = skeleton(0,view).bones;
      for(let i=1;i<=96;i++) {
        const current=skeleton(i*clip.durationMs/96,view).bones;
        for(const id of ["shoulder_l","shoulder_r","elbow_l","elbow_r","hand_l","hand_r"]) {
          const a=previous.get(id)!, b=current.get(id)!;
          expect(Math.hypot(a.x-b.x,a.y-b.y),`${id} step ${i}`).toBeLessThan(10);
          expect(Math.abs(angleDelta(a.rotation,b.rotation)),`${id} turn ${i}`).toBeLessThan(45);
        }
        for (const side of ["l","r"]) {
          const bend = (bones: typeof current) => {
            const a=bones.get(`shoulder_${side}`)!,b=bones.get(`elbow_${side}`)!,c=bones.get(`hand_${side}`)!;
            return (c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x);
          };
          expect(bend(previous)*bend(current),`${side} bend ${i}`).toBeGreaterThanOrEqual(-1e-5);
        }
        previous=current;
      }
    }
  });
  it("keeps both palms on a shared handle and feet planted, including between frames", () => {
    for (const view of ["right", "left"] as const) for (let i = 0; i <= 96; i++) {
      const time = i * clip.durationMs / 96;
      const world = skeleton(time, view).bones;
      for (const constraint of clip.ik!) {
        const goal = constraint.target ? virtualGripTarget(clip, constraint.target, time)! : constraint.keyframes[0];
        const bone = world.get(constraint.bones[2])!;
        const effector = transformPoint(worldBoneToMatrix(bone), constraint.gripSocket?.x ?? 0, 0);
        const targetX = goal.x * (view === "left" ? -1 : 1);
        if (constraint.target) {
          expect(effector.x, `${view} ${time} ${constraint.bones[2]} x`).toBeCloseTo(targetX, 4);
          expect(effector.y, `${view} ${time} ${constraint.bones[2]} y`).toBeCloseTo(goal.y, 4);
        } else {
          expect(Math.hypot(effector.x - targetX, effector.y - goal.y), `${view} ${time} ${constraint.bones[2]}`).toBeLessThan(2.0);
        }
        const [a, b, c] = constraint.bones.map(id => world.get(id)!);
        expect(Math.hypot(b.x-a.x, b.y-a.y)).toBeCloseTo(constraint.target ? 15 : 13, 5);
        expect(Math.hypot(c.x-b.x, c.y-b.y)).toBeCloseTo(constraint.target ? 13 : 10, 5);
      }
      const l = world.get("hand_l")!, r = world.get("hand_r")!;
      expect(Math.hypot(l.x-r.x, l.y-r.y)).toBeCloseTo(15, 5);
    }
  });
  it("returns to guard and exchanges near/far roles on mirror", () => {
    expect(skeleton(0,"right").bones).toEqual(skeleton(clip.durationMs,"right").bones);
    expect(resolveArmRoles("right").near).toBe(resolveArmRoles("left").far);
    for(const time of TWO_HANDED_PHASES) {
      const right=skeleton(time,"right").bones, left=skeleton(time,"left").bones;
      for(const id of ["shoulder_l","shoulder_r","hand_l","hand_r"]) {
        expect(left.get(id)!.x).toBeCloseTo(-right.get(id)!.x, 5);
        expect(left.get(id)!.y).toBeCloseTo(right.get(id)!.y, 5);
      }
    }
  });
  it("serializes the weaponless handle and both grip constraints", () => {
    expect(ProjectSchema.shape.animationClips.element.parse(JSON.parse(JSON.stringify(clip)))).toEqual(clip);
  });
});

it.skipIf(!process.env.SWORD_REVIEW)("renders seven phases through the real scene pipeline", () => {
  useStore.getState().newProject();
  useStore.getState().createEntity("character","biped_profile_base_v1","Two-handed strike");
  const project=useStore.getState().project, entity=structuredClone(project.entities[0]);
  entity.slots.forEach(slot => { slot.itemId=null; });
  const template=resolveTemplate(project,entity.templateId)!;
  const labels=["Guard","Windup","Apex","Downstroke","Contact","Follow-through","Recover"];
  const rigs: string[]=[];
  const depths: string[]=[];
  writeFileSync(`${process.env.SWORD_REVIEW}-joints.json`,JSON.stringify(TWO_HANDED_PHASES.map(time=>({time,bones:Object.fromEntries(skeleton(time,"right").bones)})),null,2));
  const panels=(["right","left"] as const).flatMap((view,row) => TWO_HANDED_PHASES.map((time,i) => {
    entity.appearance={...entity.appearance!,view};
    const pose=skeleton(time,view), scene=evaluateScene(entity,template,pose,project.items);
    const transform=`translate(${i*220+110} ${row*360+235}) scale(2)`;
    const depthArt:string[]=[];
    const art=scene.visuals.sort((a,b)=>a.zIndex-b.zIndex).map(v => {
      const b=v.localBounds;
      const markup=`<g transform="matrix(${v.worldMatrix.join(" ")})">${v.svgData.replace("<svg ",`<svg x="${b.minX}" y="${b.minY}" width="${b.maxX-b.minX}" height="${b.maxY-b.minY}" `)}</g>`;
      depthArt.push(markup.replace(/(fill|stroke)="(?!none)[^"]*"/g,`$1="${DEPTH_COLORS[v.renderDepth!.slot]}"`));
      return markup;
    }).join("");
    const rig=(["l","r"] as const).map((side,j) => {
      const points=[`shoulder_${side}`,`elbow_${side}`,`hand_${side}`].map(id=>pose.bones.get(id)!);
      return `<polyline points="${points.map(p=>`${p.x},${p.y}`).join(" ")}" fill="none" stroke="${j ? "#ff7386" : "#61d8ff"}" stroke-width="1.5"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="2" fill="${j ? "#ff7386" : "#61d8ff"}"/>`).join("")}`;
    }).join("");
    const label=`<text x="${i*220+110}" y="${row*360+330}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="14">${labels[i]} / ${view}</text>`;
    depths.push(`<g transform="${transform}">${depthArt.join("")}</g>${label}`);
    rigs.push(`<g transform="${transform}"><g opacity=".2">${art}</g>${rig}</g>${label}`);
    return `<g transform="${transform}">${art}</g>${label}`;
  }));
  const svg=(parts:string[])=>`<svg xmlns="http://www.w3.org/2000/svg" width="1540" height="720"><rect width="1540" height="720" fill="#252729"/>${parts.join("")}</svg>`;
  writeFileSync(`${process.env.SWORD_REVIEW}.svg`,svg(panels));
  writeFileSync(`${process.env.SWORD_REVIEW}-rig.svg`,svg(rigs));
  writeFileSync(`${process.env.SWORD_REVIEW}-depth.svg`,svg(depths));
});
