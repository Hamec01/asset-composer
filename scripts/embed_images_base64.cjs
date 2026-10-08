const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '../docs/CHARACTER_STUDIO_FULL_ANALYSIS_AND_OVERVIEW.md');
const screenshotsDir = path.join(__dirname, '../docs/screenshots');

let content = fs.readFileSync(mdPath, 'utf8');

content = content.replace(/!\[(.*?)\]\((\.\/screenshots\/(.*?\.png))\)/g, (match, alt, relPath, filename) => {
  const fullImgPath = path.join(screenshotsDir, filename);
  if (fs.existsSync(fullImgPath)) {
    const base64 = fs.readFileSync(fullImgPath).toString('base64');
    return `![${alt}](data:image/png;base64,${base64})`;
  }
  return match;
});

fs.writeFileSync(mdPath, content, 'utf8');
console.log('Successfully embedded all images as Base64 in', mdPath);
