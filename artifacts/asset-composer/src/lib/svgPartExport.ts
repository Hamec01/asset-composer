import { referencedAssetIds } from "./projectAssets";
import type { Entity, ExportProfile, Item, ItemFitProfile, Template } from "@/domain/types";
import { evaluateRestSkeleton, evaluateScene } from "@/lib/evaluationPipeline";
import { contentOf, getVisualResources } from "./visualContent";
import { contentSvg } from "./visualRenderer";

interface SvgPartVisualManifestEntry {
  depthBinding?: import("@/domain/types").ItemPart["depthBinding"];
  occludedByBones?: string[];
  content?: import("@/domain/types").VisualContent;
  surface?: import("@/domain/types").EvaluatedVisual["surface"];
  id: string;
  file: string;
  sourceKind: string | null;
  svgFitMode: string | null;
  zIndex: number;
  slotId: string | null;
  itemId: string | null;
  partId: string | null;
  boneId: string | null;
  worldMatrix: [number, number, number, number, number, number];
  localBounds: { minX: number; minY: number; maxX: number; maxY: number };
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

interface SvgPartManifest {
  documents?: import("@/domain/types").SpriteEditorDocument[];
  assets?: Record<string, {file:string;mimeType:string;width:number;height:number}>;
  version: string;
  entity: {
    id: string;
    name: string;
    templateId: string;
  };
  template: {
    id: string;
    skeletonFamily: string;
    viewProfile: string;
    previewWidth: number;
    previewHeight: number;
    bones?: Template["bones"];
    anchors: Template["anchors"];
    slots: Template["slots"];
  };
  visuals: SvgPartVisualManifestEntry[];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

function encodeManifest(manifest: SvgPartManifest): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(manifest, null, 2));
}

export async function buildSvgPartExportFiles(
  entities: Entity[],
  items: Item[],
  itemFitProfiles: ItemFitProfile[],
  profile: ExportProfile,
  findTemplate: (id: string) => Template | undefined,
): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  if (!profile.formats.includes("svg_parts")) return files;

  const encoder = new TextEncoder();

  for (const entity of entities) {
    const template = findTemplate(entity.templateId);
    if (!template) continue;

    const entitySlug = slugify(entity.name);
    const scene = evaluateScene(
      entity,
      template,
      evaluateRestSkeleton(template.bones, entity.bodyMorphs, entity.poseOverrides, entity.appearance),
      items,
      itemFitProfiles,
    );

    const manifest: SvgPartManifest = {
      version: scene.visuals.some(v=>v.surface||v.content?.kind!=="vector")||entity.visuals?.some(v=>v.content?.kind==="document")?"3.0":"2.0",
      entity: {
        id: entity.id,
        name: entity.name,
        templateId: entity.templateId,
      },
      template: {
        id: template.id,
        skeletonFamily: template.skeletonFamily,
        viewProfile: template.viewProfile,
        previewWidth: template.previewWidth,
        previewHeight: template.previewHeight,
        anchors: template.anchors ?? {},
        slots: template.slots,
      },
      visuals: scene.visuals.map(visual => {
        const content=contentOf(visual),asset=content.kind==="raster"?getVisualResources().assets[content.assetId]:undefined;
        const file = asset?"assets/"+asset.id+"."+asset.mimeType.split("/")[1]:"visuals/"+slugify(visual.id)+".svg";
        files[entitySlug+"/"+file] = asset ? Uint8Array.from(atob(asset.dataUri.slice(asset.dataUri.indexOf(",")+1)),c=>c.charCodeAt(0)) : encoder.encode(content.kind==="vector"?content.svgData:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(visual.surface?.sourceWidth??(visual.localBounds.maxX-visual.localBounds.minX))+' '+(visual.surface?.sourceHeight??(visual.localBounds.maxY-visual.localBounds.minY))+'">'+contentSvg(content,visual.localBounds.maxX-visual.localBounds.minX,visual.localBounds.maxY-visual.localBounds.minY)+'</svg>');
        return {
          id: visual.id,
          content: content.kind==="vector"?undefined:content,
          surface: visual.surface,
          depthBinding: visual.depthBinding ?? items.find(i => i.id === visual.itemId)?.parts?.find(p => p.id === visual.partId)?.depthBinding,
          occludedByBones: visual.occlusionMasks?.map(mask => mask.boneId).filter((id): id is string => !!id),
          file,
          sourceKind: visual.sourceKind ?? null,
          svgFitMode: visual.svgFitMode ?? null,
          zIndex: visual.zIndex,
          slotId: visual.slotId ?? null,
          itemId: visual.itemId ?? null,
          partId: visual.partId ?? null,
          boneId: visual.boneId ?? null,
          worldMatrix: [...visual.worldMatrix] as [number, number, number, number, number, number],
          localBounds: { ...visual.localBounds },
          worldBounds: { ...visual.worldBounds },
        };
      }),
    };

    if(manifest.version==="3.0"){
      manifest.template.bones = template.bones;
      const resources=getVisualResources();
      const docIds=new Set(entity.visuals?.flatMap(v=>v.content?.kind==="document"?[v.content.documentId]:[])??[]);
      manifest.documents=resources.documents.filter(d=>docIds.has(d.id)||d.studioEntityId===entity.id||d.target.entityId===entity.id);
      manifest.assets={};
      const used=referencedAssetIds({documents:manifest.documents,contents:scene.visuals.map(v=>v.content)});
      for(const asset of Object.values(resources.assets).filter(a=>used.has(a.id))){
        const file="assets/"+asset.id+"."+asset.mimeType.split("/")[1];
        manifest.assets[asset.id]={file,mimeType:asset.mimeType,width:asset.width,height:asset.height};
        files[entitySlug+"/"+file]=Uint8Array.from(atob(asset.dataUri.slice(asset.dataUri.indexOf(",")+1)),c=>c.charCodeAt(0));
      }
    }
    files[`${entitySlug}/manifest.json`] = encodeManifest(manifest);
  }

  return files;
}
