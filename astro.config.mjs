// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    plugins: [tailwindcss()],
    // Esto hace que Vite detecte cambios en sistemas de archivos montados (Docker)
    server: {
      watch: {
        usePolling: true, // ← clave para Docker
        interval: 500, // cada 500ms revisa cambios
      },
    },
  },
});
