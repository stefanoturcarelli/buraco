import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the project at https://<user>.github.io/buraco/
// so the static assets must be referenced from the /buraco/ base path.
// Override with VITE_BASE if the repo name differs.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/buraco/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
  },
});
