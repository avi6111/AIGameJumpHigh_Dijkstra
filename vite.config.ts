import { defineConfig } from "vite";

const sourcemap =
  process.env.BUILD_SOURCEMAP === "1" || process.env.BUILD_SOURCEMAP === "true";

export default defineConfig({
  base: "./",
  assetsInclude: ["**/*.vrm"],
  build: {
    chunkSizeWarningLimit: 900,
    sourcemap,
  },
  server: {
    host: true,
  },
  optimizeDeps: {
    exclude: ["three/examples/jsm/inspector/Inspector.js"],
  },
});
