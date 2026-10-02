import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [projectPath, outputPath] = process.argv.slice(2);
if (!projectPath || !outputPath) throw new Error('Expected project JSON and output directory');
const project = JSON.parse(await readFile(projectPath, 'utf8'));
const entity = project.entities.find(candidate => candidate.id === project.activeEntityId);
if (!entity?.templateId.startsWith('biped_profile_reference_')) throw new Error('Select the traced reference character first');
const template = project.templates.find(candidate => candidate.id === entity.templateId);
const docs = project.editorMeta.spriteEditorDocuments.filter(doc => doc.target.entityId === entity.id);
const world = new Map();
for (const bone of template.bones) {
  const parent = world.get(bone.parentId) ?? { x: 0, y: 0 };
  world.set(bone.id, { x: parent.x + bone.restPose.tx, y: parent.y + bone.restPose.ty });
}
await mkdir(outputPath, { recursive: true });
const attachments = [];
for (const visual of entity.visuals) {
  if (!/^[a-z_]+$/.test(visual.boneId)) throw new Error('Unsafe bone name');
  const filename = `${visual.boneId}.svg`;
  await writeFile(path.join(outputPath, filename), visual.svgData);
  const doc = docs.find(candidate => candidate.id === visual.editorDocumentId);
  attachments.push({ file: filename, name: doc.name, boneId: visual.boneId, bodyPartId: visual.bodyPartId,
    pivot: visual.pivot, localTransform: visual.localTransform, zIndex: visual.zIndex,
    width: doc.width, height: doc.height });
}
await writeFile(path.join(outputPath, 'rig.json'), JSON.stringify({
  format: 'asset-composer-rigid-parts-v1', name: entity.name,
  note: 'Editable vector parts and attachment metadata; not a Godot scene or animation importer.',
  bones: template.bones, appearance: entity.appearance, attachments,
}, null, 2));

function image(visual, x, y, scaleX, scaleY) {
  const doc = docs.find(candidate => candidate.id === visual.editorDocumentId);
  return `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})"><image href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(visual.svgData)}" x="${-visual.pivot.x}" y="${-visual.pivot.y}" width="${doc.width}" height="${doc.height}"/></g>`;
}
const assembled = [...entity.visuals].sort((a, b) => a.zIndex - b.zIndex).map(visual => {
  const bone = world.get(visual.boneId);
  const local = visual.localTransform;
  return image(visual, bone.x + local.x, bone.y + local.y, local.scaleX, local.scaleY);
}).join('');
await writeFile(path.join(outputPath, 'assembled.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="-42 -78 84 121">${assembled}</svg>`);

const order = ['head', 'neck', 'chest', 'spine', 'pelvis', 'shoulder_l', 'elbow_l', 'hand_l', 'shoulder_r', 'elbow_r', 'hand_r', 'hip_l', 'knee_l', 'foot_l', 'hip_r', 'knee_r', 'foot_r'];
const escapeXml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const sheet = order.map((boneId, index) => {
  const visual = entity.visuals.find(candidate => candidate.boneId === boneId);
  const attachment = attachments.find(candidate => candidate.boneId === boneId);
  const x = index % 4 * 190 + 95;
  const y = Math.floor(index / 4) * 170 + 75;
  return `${image(visual, x, y, 0.27, 0.27)}<text x="${x}" y="${y + 80}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#b8bdc4">${escapeXml(attachment.name)}</text>`;
}).join('');
await writeFile(path.join(outputPath, 'parts-sheet.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="850" viewBox="0 0 760 850"><rect width="760" height="850" fill="#242729"/>${sheet}</svg>`);
console.log(`Exported ${attachments.length} SVG parts, rig metadata, assembled preview and parts sheet to ${path.resolve(outputPath)}`);
