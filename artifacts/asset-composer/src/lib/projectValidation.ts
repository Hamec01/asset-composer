import { ProjectSchema } from "@/domain/schema";
import type { Project, Template } from "@/domain/types";
import { migrateProject } from "@/lib/projectMigration";
import {
  normalizeLegacySharedLimbAssignments,
  pruneLegacyBodyCloneVisualsFromEntity,
} from "@/lib/projectNormalization";

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
    const matchingTemplates = project.templates.filter(template =>
      item.compatibility.skeletonFamilies.includes(template.skeletonFamily),
    );
    const matchingBoneIds = new Set(matchingTemplates.flatMap(template => [...templateBoneIds(template)]));
    for (const part of item.parts) {
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
    const familyTemplates = project.templates.filter(template => template.skeletonFamily === clip.skeletonFamily);
    const validBoneIds = new Set(familyTemplates.flatMap(template => [...templateBoneIds(template)]));
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
