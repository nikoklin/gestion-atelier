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
  },
});
