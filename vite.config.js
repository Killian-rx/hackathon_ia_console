import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En dev, on proxifie la config et les requetes d'inference vers server.py
// (par defaut sur http://127.0.0.1:8080). Lancez les deux : `python3 server.py`
// puis `npm run dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/config": "http://127.0.0.1:8080",
      "/proxy": "http://127.0.0.1:8080",
    },
  },
  build: {
    outDir: "dist",
  },
});
