import type { RigFamilyContract, Template } from "@/domain/types";
import { getBuiltInRigFamilyById } from "@/data/rigFamilies";
import {
  resolveTemplateFacingPolicy,
  resolveTemplateRigFamilyId,
} from "@/lib/templateViewContract";

function inferAnatomyFromTemplate(template: Template): RigFamilyContract["anatomy"] {
  const id = resolveTemplateRigFamilyId(template);
  if (id.includes("quadruped")) return "quadruped";
  if (id.includes("serpent")) return "serpent";
  if (id.includes("dragon")) return "dragon";
  if (id.includes("centaur")) return "centaur";
  return "biped";
}

export function buildRigFamilyContractFromTemplate(template: Template): RigFamilyContract {
  return {
    id: resolveTemplateRigFamilyId(template),
    anatomy: inferAnatomyFromTemplate(template),
    facingPolicy: resolveTemplateFacingPolicy(template),
    logicalBoneIds: template.bones.map(bone => bone.id),
    slotIds: template.slots.map(slot => slot.id),
  };
}

export function resolveRigFamilyContract(template: Template): RigFamilyContract {
  const explicitId = resolveTemplateRigFamilyId(template);
  return getBuiltInRigFamilyById(explicitId) ?? buildRigFamilyContractFromTemplate(template);
}
