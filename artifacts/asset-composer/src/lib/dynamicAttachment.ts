import type { ItemPart, Matrix2D } from "@/domain/types";
import type { AnimationContext } from "./animationContext";
import { inverse, transformPoint } from "./matrixUtils";

/** A line constraint belongs to the attachment, not to a renderer or hard-coded item ID. */
export function deformAttachmentLine(svg:string,part:ItemPart,world:Matrix2D,target:{x:number;y:number}|undefined,context?:AnimationContext) {
  const line=part.dynamicLine;
  if(!line || !target || !context || context.clip.id!==line.clipId || context.timeMs<line.attachMs)return svg;
  const local=transformPoint(inverse(world),target.x,target.y);
  // Built-in SVG authoring translates the drawing by its viewBox origin.
  let x=local.x-part.metrics.viewBoxX, y=local.y-part.metrics.viewBoxY;
  if(context.timeMs>=line.releaseMs) {
    const t=(context.timeMs-line.releaseMs)/line.settleMs;
    if(t>=1)return svg;
    x=(line.start.x+line.end.x)/2+Math.sin(t*Math.PI*6)*2.5*(1-t);
    y=(line.start.y+line.end.y)/2;
  }
  const d = `M${line.start.x} ${line.start.y} L${x} ${y} L${line.end.x} ${line.end.y}`;
  // Attribute order and single/double quotes are not significant in SVG.
  return svg.replace(/<path\b[^>]*>/g, tag => {
    const id = tag.match(/\bid\s*=\s*(["'])(.*?)\1/)?.[2];
    if (id !== line.pathId) return tag;
    return tag.replace(/\bd\s*=\s*(["']).*?\1/, `d="${d}"`);
  });
}
