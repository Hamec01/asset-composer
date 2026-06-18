const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const workspaceRoot = path.resolve(__dirname, "..");
const appDir = path.join(workspaceRoot, "artifacts", "asset-composer");
const sourceConfigPath = path.join(appDir, "electron-builder.yml");
const tempRoot = path.join(os.tmpdir(), "asset-composer-package");
const outputDir = path.join(tempRoot, "out");
const tempConfigPath = path.join(tempRoot, "electron-builder.temp.yml");

fs.mkdirSync(tempRoot, { recursive: true });
fs.rmSync(outputDir, { recursive: true, force: true });

const sourceConfig = fs.readFileSync(sourceConfigPath, "utf8");
const patchedConfig = sourceConfig.replace(
  "output: dist/desktop",
  `output: ${outputDir.replace(/\\/g, "/")}`,
);

fs.writeFileSync(tempConfigPath, patchedConfig, "utf8");

const command = process.platform === "win32"
  ? `corepack pnpm --filter @workspace/asset-composer exec electron-builder --win --config "${tempConfigPath}"`
  : `corepack pnpm --filter @workspace/asset-composer exec electron-builder --win --config "${tempConfigPath}"`;

const result = spawnSync(command, {
  cwd: appDir,
  shell: true,
  stdio: "inherit",
});

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}

if (result.error) {
  throw result.error;
}
