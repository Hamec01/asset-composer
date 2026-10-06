import { describe,it,expect } from "vitest";
import type { SkinMesh, Bone } from "../src/domain/types";
import { skinVertices,inheritMeshWeights,renderSkinMesh } from "../src/lib/skinning";
import { identity,localTransformToMatrix,worldBoneToMatrix,multiply } from "../src/lib/matrixUtils";
import { evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { meshDeformAt } from "../src/lib/animationContext";
import { applyDrawOrder } from "../src/lib/drawOrder";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";

const mesh:SkinMesh={vertices:[
  {x:0,y:0,weights:[{boneId:"a",weight:1}]},
  {x:10,y:0,weights:[{boneId:"b",weight:1}]},
  {x:0,y:10,weights:[{boneId:"a",weight:.5},{boneId:"b",weight:.5}]},
],bindMatrices:{a:identity(),b:identity()},triangles:[0,1,2],paths:[{indices:[0,1,2],closed:true,smooth:false,fill:"#fff",stroke:"#000",strokeWidth:1}]};
describe("weighted mesh runtime",()=>{
  it("preserves setup geometry and normalizes blended weights",()=>{
    expect(skinVertices(mesh,new Map(Object.entries(mesh.bindMatrices)))).toEqual([{x:0,y:0},{x:10,y:0},{x:0,y:10}]);
    const vertices=skinVertices(mesh,new Map([["a",identity()],["b",[1,0,0,1,20,0]]]));
    expect(vertices[2]).toEqual({x:10,y:10});
    const scaled=structuredClone(mesh);scaled.vertices[2].weights.forEach(w=>w.weight*=4);
    expect(skinVertices(scaled,new Map([["a",identity()],["b",[1,0,0,1,20,0]]]))).toEqual(vertices);
  });
  it("uses inverse bind matrices and applies deformation before skinning",()=>{
    const bound=structuredClone(mesh);bound.bindMatrices.a=[1,0,0,1,10,0];bound.bindMatrices.b=[1,0,0,1,10,0];
    const pose=new Map(Object.entries(bound.bindMatrices));
    expect(skinVertices(bound,pose,[{x:2,y:3}])[0]).toEqual({x:2,y:3});
    expect(()=>skinVertices(mesh,new Map())).toThrow("Missing mesh bone");
  });
  it("inherits interpolated body weights instead of assigning the nearest bone",()=>{
    const inherited=inheritMeshWeights(mesh,[{x:2.5,y:2.5}])[0];
    expect(inherited.weights.find(w=>w.boneId==="a")!.weight).toBeCloseTo(.625);
    expect(inherited.weights.find(w=>w.boneId==="b")!.weight).toBeCloseTo(.375);
    expect(inheritMeshWeights(mesh,[{x:100,y:0}])[0].weights).toEqual([{boneId:"b",weight:1}]);
  });
  it("retains shear from scaled and rotated parents",()=>{
    const bone=(id:string,parentId:string|null,rotation:number,sx:number,tx:number):Bone=>({id,name:id,parentId,length:10,restPose:{tx,ty:0,rotation,scaleX:sx,scaleY:1}});
    const bones=[bone("a",null,30,2,0),bone("b","a",45,1,10)];
    const result=evaluateSkeleton(bones,new Map());
    const expected=multiply(localTransformToMatrix(0,0,30,2,1),localTransformToMatrix(10,0,45,1,1));
    worldBoneToMatrix(result.bones.get("b")!).forEach((v,i)=>expect(v).toBeCloseTo(expected[i]));
  });
  it("interpolates deform keys and rejects invalid contours",()=>{
    const clip=structuredClone(CHIBI_ANIMATIONS[0]);
    clip.deform=[{partId:"cloth",keyframes:[{timeMs:0,offsets:[{x:0,y:0}]},{timeMs:100,offsets:[{x:8,y:4}]}]}];
    expect(meshDeformAt({clip,timeMs:50},"cloth")).toEqual([{x:4,y:2}]);
    expect(renderSkinMesh(mesh,mesh.vertices).svgData).toContain("viewBox");
    const bad=structuredClone(mesh);bad.paths[0].indices.push(999);
    expect(()=>renderSkinMesh(bad,bad.vertices)).toThrow("Invalid mesh contour");
  });
  it("steps draw order and restores setup order at the end",()=>{
    const clip=structuredClone(CHIBI_ANIMATIONS[0]);
    clip.drawOrder=[{timeMs:100,boneOrder:["chest","hand_r"],slotOrder:[]},{timeMs:200,boneOrder:[],slotOrder:[]}];
    const visuals:any[]=[{boneId:"hand_r",zIndex:-920},{boneId:"chest",zIndex:-840}];
    applyDrawOrder(visuals,[],{clip,timeMs:150});
    expect(visuals[0].zIndex).toBeGreaterThan(visuals[1].zIndex);
    const reset:any[]=[{boneId:"hand_r",zIndex:-920},{boneId:"chest",zIndex:-840}];
    applyDrawOrder(reset,[],{clip,timeMs:200});
    expect(reset[0].zIndex).toBe(-920);
  });
});
