import type { Entity, ExportProfile, Item, ItemFitProfile, Template } from "@/domain/types";
import { evaluateRestSkeleton, evaluateScene } from "@/lib/evaluationPipeline";

interface SvgPartVisualManifestEntry {
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
      evaluateRestSkeleton(template.bones, entity.bodyMorphs),
      items,
      itemFitProfiles,
    );

    const manifest: SvgPartManifest = {
      version: "2.0",
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
        const file = `visuals/${slugify(visual.id)}.svg`;
        files[`${entitySlug}/${file}`] = encoder.encode(visual.svgData);
        return {
          id: visual.id,
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

    files[`${entitySlug}/manifest.json`] = encodeManifest(manifest);
  }

  return files;
}
