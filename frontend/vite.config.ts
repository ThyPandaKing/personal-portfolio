import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Matches the "@/*" path alias in tsconfig.json
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev proxy so the SPA can call the backend at the same origin
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
