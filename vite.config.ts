import { defineConfig } from "vite";
import vue from '@vitejs/plugin-vue'
const sourcemap =
  process.env.BUILD_SOURCEMAP === "1" || process.env.BUILD_SOURCEMAP === "true";

export default defineConfig({
  base: "/AIGameJumpHigh_Dijkstra/",
  plugins: [vue()],
  assetsInclude: ["**/*.vrm"],
  build: {
    outDir: "dist",//默认也是 dist
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
