import { ProjectSchema } from "@/domain/schema";
import type { Project, Template } from "@/domain/types";
import { migrateProject } from "@/lib/projectMigration";
import {
  normalizeLegacySharedLimbAssignments,
  pruneLegacyBodyCloneVisualsFromEntity,
} from "@/lib/projectNormalization";
import { itemSupportsTemplate } from "@/lib/templateCompatibility";

function formatSchemaErrors(message: string): string {
  return `Project schema validation failed: ${message}`;
}

function templateBoneIds(template: Template): Set<string> {
  return new Set(template.bones.map(bone => bone.id));
}

export function validateProjectReferences(project: Project): string[] {
  const errors: string[] = [];
  const templates = new Map(project.templates.map(template => [template.id, template]));
  const items = new Map(project.items.map(item => [item.id, item]));
  const clips = new Map(project.animationClips.map(clip => [clip.id, clip]));
  const templateIds = new Set<string>();
  const itemIds = new Set<string>();
  const clipIds = new Set<string>();
  const stateMachineIds = new Set<string>();

  for (const template of project.templates) {
    if (templateIds.has(template.id)) {
      errors.push(`Duplicate template id "${template.id}".`);
    }
    templateIds.add(template.id);

    const boneIds = templateBoneIds(template);
    const slotIds = new Set<string>();

    for (const bonePart of template.boneParts ?? []) {
      if (!boneIds.has(bonePart.boneId)) {
        errors.push(`Template "${template.id}" bone part "${bonePart.id}" references missing bone "${bonePart.boneId}".`);
      }
    }

    for (const [anchorId, anchor] of Object.entries(template.anchors ?? {})) {
      if (!boneIds.has(anchor.boneId)) {
        errors.push(`Template "${template.id}" anchor "${anchorId}" references missing bone "${anchor.boneId}".`);
      }
    }

    for (const slot of template.slots) {
      if (slotIds.has(slot.id)) {
        errors.push(`Template "${template.id}" has duplicate slot id "${slot.id}".`);
      }
      slotIds.add(slot.id);
      if (!boneIds.has(slot.boneId)) {
        errors.push(`Template "${template.id}" slot "${slot.id}" references missing bone "${slot.boneId}".`);
      }
      if (slot.defaultAnchorId && !template.anchors?.[slot.defaultAnchorId]) {
        errors.push(`Template "${template.id}" slot "${slot.id}" references missing default anchor "${slot.defaultAnchorId}".`);
      }
    }
  }

  for (const item of project.items) {
    if (itemIds.has(item.id)) {
      errors.push(`Duplicate item id "${item.id}".`);
    }
    itemIds.add(item.id);

    if (!item.parts?.length) continue;
    const matchingTemplates = project.templates.filter(template => itemSupportsTemplate(item, template));
    const matchingBoneIds = new Set(matchingTemplates.flatMap(template => [...templateBoneIds(template)]));
    for (const part of item.parts) {
      for (const boneId of part.occludedByBones ?? []) {
        if (matchingTemplates.length > 0 && !matchingBoneIds.has(boneId)) errors.push(`Item "${item.id}" occlusion references missing bone "${boneId}".`);
      }
      if (matchingTemplates.length > 0 && !matchingBoneIds.has(part.boneId)) {
        errors.push(`Item "${item.id}" part "${part.id}" references missing bone "${part.boneId}".`);
      }
    }
  }

  for (const clip of project.animationClips) {
    if (clipIds.has(clip.id)) {
      errors.push(`Duplicate animation clip id "${clip.id}".`);
    }
    clipIds.add(clip.id);
    const familyTemplates = project.templates.filter(template => clip.templateId?template.id===clip.templateId:template.skeletonFamily === clip.skeletonFamily);
    if(clip.templateId&&!templates.has(clip.templateId))errors.push("Animation references missing rig: "+clip.templateId);
    const validBoneIds = new Set(familyTemplates.flatMap(template => [...templateBoneIds(template)]));
    for (const track of clip.equipmentDepth ?? []) for (const key of track.keyframes) {
      if (key.timeMs > clip.durationMs) errors.push(`Animation clip "${clip.id}" equipment depth key exceeds its duration.`);
      for (const boneId of key.occludedByBones ?? []) if (familyTemplates.length > 0 && !validBoneIds.has(boneId)) errors.push(`Animation clip "${clip.id}" occlusion references missing bone "${boneId}".`);
    }
    for (const layer of clip.layers) {
      for (const track of layer.tracks) {
        if (familyTemplates.length > 0 && !validBoneIds.has(track.boneId)) {
          errors.push(`Animation clip "${clip.id}" references missing bone "${track.boneId}".`);
        }
      }
    }
  }

  for (const machine of project.stateMachines) {
    if (stateMachineIds.has(machine.id)) {
      errors.push(`Duplicate state machine id "${machine.id}".`);
    }
    stateMachineIds.add(machine.id);
    for (const state of machine.states) {
      if (state.clipId && !clips.has(state.clipId)) {
        errors.push(`State machine "${machine.id}" references missing clip "${state.clipId}".`);
      }
    }
  }

  for (const entity of project.entities) {
    const template = templates.get(entity.templateId);
    if (!template) {
      errors.push(`Entity "${entity.id}" references missing template "${entity.templateId}".`);
      continue;
    }

    const slotIds = new Set(template.slots.map(slot => slot.id));
    for (const slot of entity.slots) {
      if (!slotIds.has(slot.slotId)) {
        errors.push(`Entity "${entity.id}" references missing slot "${slot.slotId}" on template "${template.id}".`);
      }
      if (slot.itemId && !items.has(slot.itemId)) {
        errors.push(`Entity "${entity.id}" references missing item "${slot.itemId}" in slot "${slot.slotId}".`);
      }
    }
  }

  if (project.activeEntityId && !project.entities.some(entity => entity.id === project.activeEntityId)) {
    errors.push(`Active entity "${project.activeEntityId}" does not exist in the project.`);
  }

  const documents=project.editorMeta?.spriteEditorDocuments??[],documentIds=new Set(documents.map(d=>d.id));
  const checkContent=(value:{content?:import("@/domain/types").VisualContent;svgData?:string},label:string)=>{
    const check=(content:import("@/domain/types").VisualContent)=>{
      if(content.kind==="raster"&&!project.assets?.[content.assetId])errors.push(label+" references missing asset "+content.assetId);
      if(content.kind==="document"&&!documentIds.has(content.documentId))errors.push(label+" references missing document "+content.documentId);
      if(content.kind==="composite")content.children.forEach(c=>check(c.content));
    };if(value.content)check(value.content);else if(typeof value.svgData!=="string")errors.push(label+" has no artwork");
  };
  const checkParents=(nodes:{id:string;parentId?:string|null}[],label:string)=>{
    const ids=new Set(nodes.map(n=>n.id));if(ids.size!==nodes.length)errors.push(label+" contains duplicate ids");
    for(const node of nodes){let parent=node.parentId;const seen=new Set([node.id]);while(parent){if(seen.has(parent)){errors.push(label+" contains a hierarchy cycle");break;}seen.add(parent);if(!ids.has(parent)){errors.push(label+" has missing parent "+parent);break;}parent=nodes.find(n=>n.id===parent)?.parentId;}}
  };
  for(const t of project.templates){checkParents(t.bones,"Rig "+t.id);for(const v of [...(t.boneParts??[]),...t.baseBodyLayers])checkContent(v,"Template visual "+v.id);}
  for(const e of project.entities){for(const v of e.visuals??[])checkContent(v,"Entity visual "+v.id);for(const v of e.faceCustomization?.overlays??[])checkContent(v,"Face overlay "+v.id);
    for(const [feature,config] of Object.entries(e.faceCustomization??{})) if(feature!=="overlays" && !Array.isArray(config) && config?.content) checkContent(config,"Face feature "+feature);
    if(e.appearance?.noseArtwork)checkContent(e.appearance.noseArtwork,"Nose artwork");
  }
  for(const item of project.items)for(const v of [...(item.parts??[]),...item.svgLayers])checkContent(v,"Item visual "+v.id);
  for(const doc of documents){
    checkParents(doc.layers,"Artwork "+doc.id);
    const owner=project.entities.find(e=>e.id===(doc.studioEntityId??doc.target.entityId)),rig=owner?templates.get(owner.templateId):undefined;
    for(const l of doc.layers){
      if(l.kind==="raster"&&(!l.assetId||!project.assets?.[l.assetId]))errors.push("Layer "+l.id+" references missing raster");
      if(l.binding&&rig){
        const ids=templateBoneIds(rig);if(!ids.has(l.binding.boneId))errors.push("Layer binding references missing bone "+l.binding.boneId);
        if(l.binding.mode==="weighted")for(const v of l.binding.mesh.vertices)for(const w of v.weights)if(!ids.has(w.boneId))errors.push("Mesh references missing bone "+w.boneId);
      }
    }
  }
  return errors;
}

export function parseProjectSnapshot(raw: unknown): Project {
  const migrated = migrateProject(raw);
  const parsed = ProjectSchema.safeParse(migrated);
  if (!parsed.success) {
    throw new Error(formatSchemaErrors(parsed.error.issues.map(issue => issue.message).join("; ")));
  }

  const project = parsed.data as Project;
  const templateById = new Map(project.templates.map(template => [template.id, template]));
  const normalizedEntities = project.entities.map(entity => {
    const template = templateById.get(entity.templateId);
    const splitEntity = normalizeLegacySharedLimbAssignments(entity, template, project.items);
    return pruneLegacyBodyCloneVisualsFromEntity(splitEntity, template);
  });
  const normalizedProject = normalizedEntities === project.entities
    ? project
    : {
        ...project,
        entities: normalizedEntities,
      };
  const referenceErrors = validateProjectReferences(normalizedProject);
  if (referenceErrors.length > 0) {
    throw new Error(referenceErrors.join(" "));
  }

  return normalizedProject;
}
