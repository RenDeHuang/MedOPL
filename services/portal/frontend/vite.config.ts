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

const goControlPlaneTarget = process.env.VITE_MEDOPL_GO_BACKEND_URL || "http://127.0.0.1:8789";

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
      "/api": goControlPlaneTarget
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  assetsInclude: ["**/*.svg", "**/*.csv"]
});
