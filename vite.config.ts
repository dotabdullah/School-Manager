import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const APP_MODE = process.env.VITE_APP_MODE ?? "school";

// Tauri expects a fixed port and relative asset paths
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Vite has no reason to watch Rust source/build output — and on Windows,
      // watching src-tauri/target while Cargo is actively compiling causes
      // EBUSY crashes because Cargo locks/rewrites files mid-build.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  resolve: {
    alias:
      APP_MODE === "creator"
        ? {}
        : {
            // School builds never see the real CreatorAdminPanel module — it's
            // swapped for an inert stub before Rollup even builds the module graph,
            // so the license-signing UI/logic can't be extracted from the shipped .exe.
            "./CreatorAdminPanel": path.resolve(__dirname, "src/pages/CreatorAdminPanel.stub.tsx"),
          },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
