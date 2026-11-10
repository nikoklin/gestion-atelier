import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";


const plugins = [
  react(),
  tailwindcss(),
  // Service worker (dist/public/sw.js) : garde l'interface sur la tablette de pointage
  // pour qu'elle reste utilisable sans réseau. Enregistré seulement par la page de
  // pointage (client/src/pages/CheckIn.tsx). Les appels au serveur (/api) ne sont
  // jamais mis en cache par lui : la file des pointages est gérée par la page.
  VitePWA({
    injectRegister: false,
    registerType: "autoUpdate",
    manifest: false,
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
          handler: "StaleWhileRevalidate",
          options: { cacheName: "polices", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
        },
      ],
    },
  }),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    // NB: en dev, ce bloc `server` est remplacé par server/_core/vite.ts
    // (mode middleware). Conservé pour un éventuel `vite` lancé directement.
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
