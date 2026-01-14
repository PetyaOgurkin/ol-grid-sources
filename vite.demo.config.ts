import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "./demo",
  base: "./",
  resolve: {
    alias: {
      "ol-grid-sources": resolve(__dirname, "./src/index.ts"),
    },
  },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
});
