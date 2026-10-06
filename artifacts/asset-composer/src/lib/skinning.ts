import type { Matrix2D, SkinMesh } from "@/domain/types";
import { inverse, multiply, transformPoint } from "./matrixUtils";

export type Point = { x: number; y: number };

/** LBS: p' = sum(weight * currentWorld * inverseBind * (p + deform)). */
export function skinVertices(mesh: SkinMesh, matrices: ReadonlyMap<string, Matrix2D>, offsets: Point[] = []): Point[] {
  const transforms = new Map<string, Matrix2D>();
  for (const [id, bind] of Object.entries(mesh.bindMatrices)) {
    const current = matrices.get(id);
    if (!current) throw new Error(`Missing mesh bone: ${id}`);
    if (Math.abs(bind[0]*bind[3]-bind[1]*bind[2]) < 1e-9) throw new Error(`Singular bind matrix: ${id}`);
    transforms.set(id, multiply(current,inverse(bind)));
  }
  return mesh.vertices.map((v,i) => {
    let x=0,y=0,total=0;
    for (const influence of v.weights) {
      if (!Number.isFinite(influence.weight) || influence.weight < 0) throw new Error("Invalid skin weight");
      const m=transforms.get(influence.boneId);
      if (!m) throw new Error(`Missing bind matrix: ${influence.boneId}`);
      const p=transformPoint(m,v.x+(offsets[i]?.x??0),v.y+(offsets[i]?.y??0));
      x+=p.x*influence.weight; y+=p.y*influence.weight; total+=influence.weight;
    }
    if (total <= 1e-9) throw new Error("Unweighted mesh vertex");
    return {x:x/total,y:y/total};
  });
}

/** Transfer body weights by barycentric interpolation, with nearest-vertex fallback outside the surface. */
export function inheritMeshWeights(parent: SkinMesh, points: Point[]): SkinMesh["vertices"] {
  return points.map(p => {
    const accum=new Map<string,number>();
    let contributors: [number,number][]=[];
    for (let i=0;i<parent.triangles.length;i+=3) {
      const ids=parent.triangles.slice(i,i+3);
      const [a,b,c]=ids.map(id=>parent.vertices[id]);
      if (!a || !b || !c) throw new Error("Invalid parent triangle");
      const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
      if (Math.abs(det)<1e-9) continue;
      const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/det;
      const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/det;
      const w=1-u-v;
      if (Math.min(u,v,w)>=-1e-7) { contributors=ids.map((id,j)=>[id,Math.max(0,[u,v,w][j])]); break; }
    }
    if (!contributors.length) {
      if (!parent.vertices.length) throw new Error("Empty parent mesh");
      let nearest=0;
      parent.vertices.forEach((v,i)=>{if(Math.hypot(v.x-p.x,v.y-p.y)<Math.hypot(parent.vertices[nearest].x-p.x,parent.vertices[nearest].y-p.y))nearest=i;});
      contributors=[[nearest,1]];
    }
    for (const [index,factor] of contributors) for (const w of parent.vertices[index].weights) accum.set(w.boneId,(accum.get(w.boneId)??0)+w.weight*factor);
    const total=[...accum.values()].reduce((a,b)=>a+b,0);
    if (total<=0) throw new Error("Unweighted parent mesh");
    return {...p,weights:[...accum].filter(([,w])=>w>1e-9).map(([boneId,weight])=>({boneId,weight:weight/total}))};
  });
}

const escape = (s: string) => s.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
export function renderSkinMesh(mesh: SkinMesh, vertices: Point[]) {
  const padding=Math.max(1,...mesh.paths.map(p=>p.strokeWidth));
  const bounds={minX:Math.min(...vertices.map(p=>p.x))-padding,minY:Math.min(...vertices.map(p=>p.y))-padding,maxX:Math.max(...vertices.map(p=>p.x))+padding,maxY:Math.max(...vertices.map(p=>p.y))+padding};
  const point=(p:Point)=>`${p.x.toFixed(4)} ${p.y.toFixed(4)}`;
  const mid=(a:Point,b:Point)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const paths=mesh.paths.map(path=>{
    const pts=path.indices.map(i=>vertices[i]);
    if(pts.length<2 || pts.some(p=>!p)) throw new Error("Invalid mesh contour");
    const d=path.smooth && path.closed
      ? `M${point(mid(pts.at(-1)!,pts[0]))}`+pts.map((p,i)=>`Q${point(p)} ${point(mid(p,pts[(i+1)%pts.length]))}`).join("")+"Z"
      : `M${pts.map(point).join("L")}${path.closed?"Z":""}`;
    return `<path d="${d}" fill="${escape(path.fill)}" stroke="${escape(path.stroke)}" stroke-width="${path.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join("");
  return {bounds,svgData:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX} ${bounds.minY} ${bounds.maxX-bounds.minX} ${bounds.maxY-bounds.minY}">${paths}</svg>`};
}
