import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import type { Plugin } from "vite";

function resolveRequestedPort() {
  const cliArgs = process.argv;
  const portIndex = cliArgs.findIndex(arg => arg === "--port");
  const cliPortValue =
    portIndex >= 0 && portIndex + 1 < cliArgs.length
      ? cliArgs[portIndex + 1]
      : null;

  const rawPort =
    cliPortValue ??
    process.env.npm_config_port ??
    process.env.PORT ??
    null;

  const parsed = rawPort ? Number(rawPort) : Number.NaN;
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : 5173;
}

const port = resolveRequestedPort();

const basePath = process.env.BASE_PATH ?? "/";

function legacyPwaDevCompat(): Plugin {
  return {
    name: "legacy-pwa-dev-compat",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/@vite-plugin-pwa/pwa-entry-point-loaded") {
          res.statusCode = 204;
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.end("");
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    legacyPwaDevCompat(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
