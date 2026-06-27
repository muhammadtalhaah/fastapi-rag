import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const env = loadEnv("", process.cwd(), "");

// Dev proxy forwards /api to the FastAPI backend so the browser talks to one origin.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": {
        target: env.VITE_BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
