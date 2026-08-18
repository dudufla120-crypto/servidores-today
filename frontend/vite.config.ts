import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  root: ".",
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  resolve: {
    alias: {
      "@components": fileURLToPath(new URL("../components", import.meta.url)),
      "@pages": fileURLToPath(new URL("../pages", import.meta.url)),
      "@api": fileURLToPath(new URL("../api", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [".."] },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});