import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
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
      "/portal/tasks": "http://127.0.0.1:17080",
      "/portal/admin": "http://127.0.0.1:17080"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
