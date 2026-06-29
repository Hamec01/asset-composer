import type { RigFamilyContract } from "@/domain/types";
import { cloneTemplates } from "@/data/templates";
import {
  resolveTemplateFacingPolicy,
  resolveTemplateRigFamilyId,
} from "@/lib/templateViewContract";

function inferAnatomy(id: string): RigFamilyContract["anatomy"] {
  if (id.includes("quadruped")) return "quadruped";
  if (id.includes("serpent")) return "serpent";
  if (id.includes("dragon")) return "dragon";
  if (id.includes("centaur")) return "centaur";
  return "biped";
}

function contractForTemplate(templateId: string): RigFamilyContract {
  const template = cloneTemplates().find(candidate => candidate.id === templateId);
  if (!template) {
    throw new Error(`Missing built-in template "${templateId}" for rig family contract.`);
  }
  const id = resolveTemplateRigFamilyId(template);
  return {
    id,
    anatomy: inferAnatomy(id),
    facingPolicy: resolveTemplateFacingPolicy(template),
    logicalBoneIds: template.bones.map(bone => bone.id),
    slotIds: template.slots.map(slot => slot.id),
  };
}

export const BUILT_IN_RIG_FAMILIES: RigFamilyContract[] = [
  contractForTemplate("humanoid_side_v1"),
  contractForTemplate("humanoid_topdown_v1"),
  contractForTemplate("quadruped_side_v1"),
];

export function getBuiltInRigFamilyById(id: string): RigFamilyContract | undefined {
  return BUILT_IN_RIG_FAMILIES.find(contract => contract.id === id);
}
