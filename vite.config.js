import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

const srcPath = fileURLToPath(new URL("./src", import.meta.url)).replace(/\\/g, "/");

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: "@", replacement: srcPath },
      { find: /^\/src\//, replacement: `${srcPath}/` },
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
