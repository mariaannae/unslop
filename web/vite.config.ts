import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the Worker runs on 8787 (`pnpm dev:worker`); proxying keeps
    // the browser same-origin so no CORS handling is needed anywhere.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
