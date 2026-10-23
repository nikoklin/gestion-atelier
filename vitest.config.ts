import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  // Même alias que vite.config.ts / tsconfig.json, pour pouvoir tester les routes tRPC.
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Les tests passent par la vraie base distante (nombreux allers-retours).
    testTimeout: 30000,
    // Un fichier à la fois : ils partagent la vraie base (réglages de l'atelier
    // compris) ; en parallèle, deux fichiers qui modifient puis restaurent le
    // même réglage peuvent le laisser dans un mauvais état.
    fileParallelism: false,
  },
});
