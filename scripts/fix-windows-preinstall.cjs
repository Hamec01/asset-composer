const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const backupPath = path.join(root, "package.json.before-windows-fix.bak");
const preinstallPath = path.join(root, "scripts", "preinstall.cjs");

if (!fs.existsSync(packagePath)) {
  console.error("[ERROR] package.json was not found:", packagePath);
  process.exit(1);
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(packagePath, backupPath);
  console.log("[OK] Backup created:", backupPath);
}

const raw = fs.readFileSync(packagePath, "utf8").replace(/^\uFEFF/, "");
let pkg;
try {
  pkg = JSON.parse(raw);
} catch (error) {
  console.error("[ERROR] package.json is not valid JSON.");
  console.error(error);
  process.exit(1);
}

pkg.scripts = pkg.scripts || {};
pkg.scripts.preinstall = "node scripts/preinstall.cjs";

fs.mkdirSync(path.dirname(preinstallPath), { recursive: true });
fs.writeFileSync(
  preinstallPath,
  `const fs = require("node:fs");

for (const file of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Ignore cleanup errors.
  }
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
`,
  "utf8"
);

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

console.log("[OK] package.json preinstall was changed to:");
console.log('     "preinstall": "node scripts/preinstall.cjs"');
console.log("[OK] Created:", preinstallPath);
