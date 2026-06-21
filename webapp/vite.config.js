import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev proxy forwards /api to the FastAPI backend so the browser talks to one origin.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
