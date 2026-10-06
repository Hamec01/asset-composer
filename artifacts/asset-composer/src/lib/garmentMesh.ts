import type { BonePart, SkinMesh, Matrix2D } from "@/domain/types";
import { transformPoint } from "./matrixUtils";
import { inheritMeshWeights } from "./skinning";

/** Body and garment share a triangulated torso surface, in setup space. */
export function createGarmentMesh(bind: ReadonlyMap<string,Matrix2D>, body: BonePart[], fill:string, female:boolean): SkinMesh {
  const vertices:SkinMesh["vertices"]=[];
  const triangles:number[]=[];
  const rows=13;
  for(let row=0;row<rows;row++) {
    const t=row/(rows-1);
    const upper=t<.55;
    const u=upper?t/.55:(t-.55)/.45;
    const first=upper?"chest":"spine", second=upper?"spine":"pelvis";
    const a=transformPoint(bind.get(first)!,0,upper?-5:3);
    const b=transformPoint(bind.get(second)!,0,upper?3:5);
    const widthA=(body.find(p=>p.boneId===first)?.naturalWidth??22)/2;
    const widthB=(body.find(p=>p.boneId===second)?.naturalWidth??22)/2;
    let half=widthA*(1-u)+widthB*u;
    if(row===0)half*=.62;
    if(female && t>.08 && t<.4)half*=1.1;
    const sign=bind.get(first)![0]<0?-1:1;
    for(const side of [-1,1])vertices.push({x:a.x*(1-u)+b.x*u+side*half*sign,y:a.y*(1-u)+b.y*u,weights:[{boneId:first,weight:1-u},{boneId:second,weight:u}]});
    if(row) {const i=row*2;triangles.push(i-2,i-1,i,i-1,i+1,i);}
  }
  const outline=[...Array.from({length:rows},(_,i)=>i*2),...Array.from({length:rows},(_,i)=>(rows-1-i)*2+1)];
  const parent:SkinMesh={vertices,triangles,bindMatrices:Object.fromEntries(bind),paths:[]};
  return {...parent,vertices:inheritMeshWeights(parent,vertices),paths:[
    {indices:outline,closed:true,smooth:true,fill,stroke:"#493D35",strokeWidth:.7},
    {indices:[0,1],closed:false,smooth:false,fill:"none",stroke:"#D4A24C",strokeWidth:1},
    {indices:[24,25],closed:false,smooth:false,fill:"none",stroke:"#75543B",strokeWidth:1.6},
  ]};
}
