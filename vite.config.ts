import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "OlGridSources",
      fileName: (format) => `ol-grid-sources.${format}.js`,
    },
    rollupOptions: {
      external: [/^ol.*/],
      output: {
        globals: {
          ol: "ol",
          "ol/source/DataTile": "ol.source.DataTile",
          "ol/layer/WebGLTile": "ol.layer.WebGLTile",
          "ol/tilegrid": "ol.tilegrid",
          "ol/proj": "ol.proj",
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
