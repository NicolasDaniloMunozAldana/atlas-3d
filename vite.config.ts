import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Sesión 42: Three.js (la mayor parte del peso) va en su propio archivo: el código de la app
        // cambia a menudo, Three.js casi nunca, y así son dos descargas que se cachean por separado.
        // (Vite 8 usa Rolldown: ahí manualChunks se escribe como función, no como objeto.)
        manualChunks(id: string) {
          if (id.includes("/node_modules/three/")) return "three";
        },
      },
    },
  },
  plugins: [
    VitePWA({
      // El manifest ya existe a mano desde la Sesión 27 (public/manifest.json,
      // enlazado en index.html) — aquí solo se gestiona el Service Worker.
      manifest: false,
      registerType: "autoUpdate",
      injectRegister: false, // registramos nosotros mismos en main.ts, con virtual:pwa-register

      // Sesión 34: Workbox integrado al build (la lista de precaché sale de dist/, con los hash reales).
      // Sesión 37: de generateSW (Workbox escribe el SW) a injectManifest (escribimos src/sw.ts y el
      // plugin solo le inyecta la lista de precaché).
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{html,js,css,png,json,svg}"],
        // Las fichas de modelos NO se precachean: se descargan bajo demanda. Sin esta línea, el patrón
        // **/*.json las metería en el precaché y la descarga «voluntaria» no tendría sentido.
        globIgnores: ["modelos/**"],
      },
    }),
  ],
});
