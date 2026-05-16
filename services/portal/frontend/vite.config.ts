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
  }
});
