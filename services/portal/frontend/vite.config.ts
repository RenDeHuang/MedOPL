import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id: string) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(__dirname, "src/assets", filename);
      }
      return undefined;
    },
  };
}

const portalBackendTarget = process.env.VITE_PORTAL_BACKEND_URL || "http://127.0.0.1:17080";

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 17180,
    proxy: {
      "/portal/api": portalBackendTarget,
      "/portal/billing": portalBackendTarget,
      "/portal/workspace-session": portalBackendTarget,
      "/portal/workspaces": portalBackendTarget,
      "/portal/admin": portalBackendTarget,
      "/login": portalBackendTarget,
      "/register": portalBackendTarget,
      "/logout": portalBackendTarget,
      "/auth": portalBackendTarget,
      "/opl/entry/preflight": portalBackendTarget
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  assetsInclude: ["**/*.svg", "**/*.csv"]
});
