import type { EvaluatedVisual, Item } from "@/domain/types";
import type { AnimationContext } from "./animationContext";

/** Stepped timeline. Empty keys restore setup order; unlisted attachments keep setup depth. */
export function applyDrawOrder(visuals: EvaluatedVisual[], items: Item[], context?: AnimationContext, nearSide: "l" | "r" = "l") {
  if(!context)return;
  const frame=context.clip.drawOrder?.filter(f=>f.timeMs<=context.timeMs).sort((a,b)=>a.timeMs-b.timeMs).at(-1);
  if(!frame)return;
  const boneOf=(visual:EvaluatedVisual)=>visual.boneId ?? items.find(i=>i.id===visual.itemId)?.parts?.find(p=>p.id===visual.partId)?.boneId;

  if(frame.raise?.length) {
    // Spine-style relative key: only the listed bones move. Each group keeps its own
    // internal layering and lands just above the target bone's topmost visual.
    const raised=new Map(frame.raise.filter(r=>!r.onlyNear || r.boneId.endsWith(`_${nearSide}`)).map(r=>[r.boneId,r.above]));
    const groups=new Map<string,EvaluatedVisual[]>();
    for(const visual of visuals) {
      const above=raised.get(boneOf(visual) ?? "");
      if(above)groups.set(above,[...(groups.get(above)??[]),visual]);
    }
    for(const [above,group] of groups) {
      const anchors=visuals.filter(v=>boneOf(v)===above && !group.includes(v));
      if(!anchors.length)continue;
      const top=Math.max(...anchors.map(v=>v.zIndex));
      // The authored rule order determines overlap between bones. Keep each
      // bone's skin, sleeve and held item in their original relative order.
      const order = [...raised.keys()];
      const ordered=[...group].sort((a,b)=>order.indexOf(boneOf(a)!) - order.indexOf(boneOf(b)!) || a.zIndex-b.zIndex);
      // Stay below anything that was already stacked above the target (e.g. slot overlays).
      const ceiling=Math.min(top+1,...visuals.filter(v=>v.zIndex>top && !group.includes(v)).map(v=>v.zIndex));
      ordered.forEach((visual,index)=>{visual.zIndex=top+(ceiling-top)*(index+1)/(ordered.length+1);});
    }
    return;
  }

  for(const visual of visuals) {
    const boneId=boneOf(visual);
    const boneIndex=boneId?frame.boneOrder.indexOf(boneId):-1;
    // Face features retain their own order above the head.
    if(boneIndex>=0 && !visual.entityVisualId?.startsWith("face__"))visual.zIndex=-950+boneIndex*10+(visual.sourceKind==="item-part"?1:0);
    const slotIndex=visual.slotId?frame.slotOrder.indexOf(visual.slotId):-1;
    if(slotIndex>=0)visual.zIndex=slotIndex*10;
  }
}
