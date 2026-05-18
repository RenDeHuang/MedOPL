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
      "/portal/api": "http://127.0.0.1:17080",
      "/portal/workspace-session": "http://127.0.0.1:17080",
      "/portal/workspaces": "http://127.0.0.1:17080",
      "/portal/admin": "http://127.0.0.1:17080",
      "/login": "http://127.0.0.1:17080",
      "/register": "http://127.0.0.1:17080",
      "/logout": "http://127.0.0.1:17080",
      "/auth": "http://127.0.0.1:17080",
      "/opl/entry/preflight": "http://127.0.0.1:17080"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  assetsInclude: ["**/*.svg", "**/*.csv"]
});
